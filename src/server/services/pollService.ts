import { createHash } from "node:crypto";
import type { PollResponse, SessionMetadata, MessageMeta, PlanProgress, ActivitySession, PartMeta } from "../../shared/types";
import { listAllSessions, checkStorageExists } from "../storage/sessionParser";
import { listMessages } from "../storage/messageParser";
import { parseBoulder, calculatePlanProgress } from "../storage/boulderParser";
import { getPartsForSession, getSessionActivityState, isPendingToolCall, generateActivityMessage, deriveActivityType } from "../storage/partParser";
import { getSessionStatusInfo } from "../utils/sessionStatus";
import { resolveProjectDirectory } from "../utils/projectResolver";
import { isAssistantFinished, getSessionHierarchy } from "./sessionService";
import { aggregateSessionStats } from "./statsService";
import { TWENTY_FOUR_HOURS_MS, MAX_SESSIONS_LIMIT, MAX_MESSAGES_LIMIT, POLL_CACHE_TTL_MS } from "../../shared/constants";

function getLatestAssistantMessage(messages: MessageMeta[]): MessageMeta | undefined {
  return messages
    .filter((message) => message.role === "assistant")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

function getMostRecentPendingPart(parts: PartMeta[]): PartMeta | undefined {
  return parts
    .filter((part) => isPendingToolCall(part))
    .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0))[0];
}

function sessionPriority(session: SessionMetadata): number {
  if (session.activityType === "waiting-user") return 4;
  if (session.status === "working") return 3;
  if (session.status === "waiting") return 2;
  if (session.status === "idle") return 1;
  return 0;
}

export function generateETag(data: PollResponse): string {
   const dataForHash = {
     sessions: data.sessions,
     activeSession: data.activeSession,
     planProgress: data.planProgress,
     messages: data.messages,
     activitySessions: data.activitySessions,
   };
   const hash = createHash("sha256")
     .update(JSON.stringify(dataForHash))
     .digest("hex");
   return `"${hash.substring(0, 16)}"`;
}

type PollCacheEntry = { data: PollResponse; etag: string; timestamp: number };

const pollCacheMap = new Map<string, PollCacheEntry>();
const pollInProgressMap = new Map<string, Promise<PollResponse>>();
let pollCacheEpoch = 0;

function cacheKey(projectId?: string): string {
  return projectId ?? '';
}

export function getPollCache(projectId?: string): PollCacheEntry | null {
  return pollCacheMap.get(cacheKey(projectId)) ?? null;
}

export function setPollCache(cache: PollCacheEntry | null, projectId?: string) {
  const key = cacheKey(projectId);
  if (cache) {
    pollCacheMap.set(key, cache);
  } else {
    pollCacheMap.delete(key);
  }
}

export function getPollCacheEpoch() {
  return pollCacheEpoch;
}

export function invalidatePollCache() {
  pollCacheEpoch += 1;
  pollCacheMap.clear();
}

export function getPollInProgress(projectId?: string): Promise<PollResponse> | null {
  return pollInProgressMap.get(cacheKey(projectId)) ?? null;
}

export function setPollInProgress(promise: Promise<PollResponse> | null, projectId?: string) {
  const key = cacheKey(projectId);
  if (promise) {
    pollInProgressMap.set(key, promise);
  } else {
    pollInProgressMap.delete(key);
  }
}

export function getPollCacheTTL() {
  return POLL_CACHE_TTL_MS;
}

export async function fetchPollData(sessionId?: string, projectId?: string): Promise<PollResponse> {
  const storageExists = await checkStorageExists();
  if (!storageExists) {
    return {
      sessions: [],
      activeSession: null,
      planProgress: null,
      messages: [],
      activitySessions: [],
      lastUpdate: Date.now(),
    };
  }

  const allSessions = await listAllSessions();
  let scopedSessions = allSessions;
  let selectedProjectDirectory: string | null = null;

  if (projectId) {
    selectedProjectDirectory = await resolveProjectDirectory(projectId, allSessions);
    scopedSessions = allSessions.filter((session) => session.projectID === projectId);
  }

  const now = Date.now();
  const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;

  const recentSessions = scopedSessions.filter(
    (s) => s.updatedAt.getTime() >= twentyFourHoursAgo
  );

  const sortedSessions = recentSessions.sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  const limitedSessions = sortedSessions.slice(0, MAX_SESSIONS_LIMIT);
  const rootSessions = limitedSessions.filter(s => !s.parentID);

  const messagesCache = new Map<string, MessageMeta[]>();
  const partsCache = new Map<string, PartMeta[]>();

  async function getCachedMessages(id: string): Promise<MessageMeta[]> {
    if (!messagesCache.has(id)) {
      messagesCache.set(id, await listMessages(id));
    }
    return messagesCache.get(id)!;
  }

  async function getCachedParts(id: string): Promise<PartMeta[]> {
    if (!partsCache.has(id)) {
      partsCache.set(id, await getPartsForSession(id));
    }
    return partsCache.get(id)!;
  }

  const sessionsWithAgent = await Promise.all(
    rootSessions.map(async (session) => {
      const messages = await getCachedMessages(session.id);
      const latestAssistantMsg = getLatestAssistantMessage(messages);
      const parts = await getCachedParts(session.id);
      const activityState = getSessionActivityState(parts);
      const lastAssistantFinished = isAssistantFinished(messages);
      
      const statusInfo = getSessionStatusInfo(
        messages,
        activityState.hasPendingToolCall,
        activityState.lastToolCompletedAt || undefined,
        undefined,
        lastAssistantFinished
      );
      const status = statusInfo.status;
      
      const pendingPart = getMostRecentPendingPart(parts);
      const currentAction = generateActivityMessage(
        activityState,
        lastAssistantFinished,
        false,
        status,
        pendingPart,
        statusInfo.waitingReason
      );
      
      const activityType = deriveActivityType(activityState, lastAssistantFinished, false, status, statusInfo.waitingReason);
      
      return {
        ...session,
        agent: latestAssistantMsg?.agent || null,
        modelID: latestAssistantMsg?.modelID || null,
        providerID: latestAssistantMsg?.providerID || null,
        status,
        activityType,
        currentAction,
      };
    })
  );

   let activeSession: SessionMetadata | null = null;
   const activeEnriched = [...sessionsWithAgent].sort((a, b) => {
     const priorityDiff = sessionPriority(b) - sessionPriority(a);
     if (priorityDiff !== 0) {
       return priorityDiff;
     }
     return b.updatedAt.getTime() - a.updatedAt.getTime();
   })[0];
   if (activeEnriched && sessionPriority(activeEnriched) === 0) {
     activeSession = null;
   } else if (activeEnriched) {
     activeSession = rootSessions.find(s => s.id === activeEnriched.id) ?? null;
   }

  let planProgress: PlanProgress | null = null;
  let planName: string | undefined;
  const planDirectory = projectId ? selectedProjectDirectory : process.cwd();
  if (planDirectory) {
    try {
      const boulder = await parseBoulder(planDirectory);
      if (boulder?.activePlan) {
        planProgress = await calculatePlanProgress(boulder.activePlan);
        planName = boulder.planName || undefined;
      }
    } catch (err) {
      console.debug('Failed to parse boulder.json:', err instanceof Error ? err.message : err);
    }
  }

  let messages: MessageMeta[] = [];
  let activitySessions: ActivitySession[] = [];
  let sessionStats = undefined;
  const scopedSessionIds = new Set(scopedSessions.map((session) => session.id));
  const requestedSessionId =
    sessionId && (!projectId || scopedSessionIds.has(sessionId))
      ? sessionId
      : undefined;
  const targetSessionId = requestedSessionId || activeSession?.id;
  if (targetSessionId) {
    const fetchedMessages = await getCachedMessages(targetSessionId);
    const sortedMessages = fetchedMessages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    messages = sortedMessages.slice(0, MAX_MESSAGES_LIMIT);
    
    activitySessions = await getSessionHierarchy(targetSessionId, scopedSessions);
    
    for (const session of activitySessions) {
      await getCachedMessages(session.id);
    }
    
    sessionStats = aggregateSessionStats(activitySessions, messagesCache);
  }

  return {
    sessions: sessionsWithAgent,
    activeSession,
    planProgress,
    planName,
    messages,
    activitySessions,
    sessionStats,
    lastUpdate: now,
  };
}
