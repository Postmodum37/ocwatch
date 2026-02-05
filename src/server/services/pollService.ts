import { createHash } from "node:crypto";
import type { PollResponse, SessionMetadata, MessageMeta, PlanProgress, ActivitySession } from "../../shared/types";
import { listAllSessions, checkStorageExists } from "../storage/sessionParser";
import { listMessages, getFirstAssistantMessage } from "../storage/messageParser";
import { parseBoulder, calculatePlanProgress } from "../storage/boulderParser";
import { getPartsForSession, getSessionActivityState, isPendingToolCall, generateActivityMessage, deriveActivityType } from "../storage/partParser";
import { getSessionStatus } from "../utils/sessionStatus";
import { isAssistantFinished, getSessionHierarchy } from "./sessionService";
import { aggregateSessionStats } from "./statsService";
import { TWENTY_FOUR_HOURS_MS, MAX_SESSIONS_LIMIT, MAX_MESSAGES_LIMIT, POLL_CACHE_TTL_MS } from "../../shared/constants";

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

let pollCache: { data: PollResponse; etag: string; timestamp: number } | null = null;
let pollInProgress: Promise<PollResponse> | null = null;

export function getPollCache() {
  return pollCache;
}

export function setPollCache(cache: { data: PollResponse; etag: string; timestamp: number } | null) {
  pollCache = cache;
}

export function getPollInProgress() {
  return pollInProgress;
}

export function setPollInProgress(promise: Promise<PollResponse> | null) {
  pollInProgress = promise;
}

export function getPollCacheTTL() {
  return POLL_CACHE_TTL_MS;
}

export async function fetchPollData(sessionId?: string): Promise<PollResponse> {
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

  const now = Date.now();
  const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;

  const recentSessions = allSessions.filter(
    (s) => s.updatedAt.getTime() >= twentyFourHoursAgo
  );

  const sortedSessions = recentSessions.sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  const limitedSessions = sortedSessions.slice(0, MAX_SESSIONS_LIMIT);
  const rootSessions = limitedSessions.filter(s => !s.parentID);

  const messagesCache = new Map<string, MessageMeta[]>();
  async function getCachedMessages(id: string): Promise<MessageMeta[]> {
    if (!messagesCache.has(id)) {
      messagesCache.set(id, await listMessages(id));
    }
    return messagesCache.get(id)!;
  }

  const sessionsWithAgent = await Promise.all(
    rootSessions.map(async (session) => {
      const firstAssistantMsg = await getFirstAssistantMessage(session.id);
      const messages = await getCachedMessages(session.id);
      const parts = await getPartsForSession(session.id);
      const activityState = getSessionActivityState(parts);
      const lastAssistantFinished = isAssistantFinished(messages);
      
      const status = getSessionStatus(
        messages,
        activityState.hasPendingToolCall,
        activityState.lastToolCompletedAt || undefined,
        undefined,
        lastAssistantFinished
      );
      
      const pendingParts = parts.filter(p => isPendingToolCall(p));
      const currentAction = generateActivityMessage(
        activityState,
        lastAssistantFinished,
        false,
        status,
        pendingParts[0]
      );
      
      const activityType = deriveActivityType(activityState, lastAssistantFinished, false, status);
      
      return {
        ...session,
        agent: firstAssistantMsg?.agent || null,
        modelID: firstAssistantMsg?.modelID || null,
        providerID: firstAssistantMsg?.providerID || null,
        status,
        activityType,
        currentAction,
      };
    })
  );

   let activeSession: SessionMetadata | null = null;
   const activeEnriched = sessionsWithAgent.find(
     s => s.status === "working" || s.status === "idle"
   );
   if (activeEnriched) {
     activeSession = rootSessions.find(s => s.id === activeEnriched.id) ?? null;
   }

  let planProgress: PlanProgress | null = null;
  try {
    const cwd = process.cwd();
    const boulder = await parseBoulder(cwd);
    if (boulder?.activePlan) {
      planProgress = await calculatePlanProgress(boulder.activePlan);
    }
  } catch (err) {
    console.debug('Failed to parse boulder.json:', err instanceof Error ? err.message : err);
  }

  let messages: MessageMeta[] = [];
  let activitySessions: ActivitySession[] = [];
  let sessionStats = undefined;
  const targetSessionId = sessionId || activeSession?.id;
  if (targetSessionId) {
    const fetchedMessages = await getCachedMessages(targetSessionId);
    const sortedMessages = fetchedMessages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    messages = sortedMessages.slice(0, MAX_MESSAGES_LIMIT);
    
    activitySessions = await getSessionHierarchy(targetSessionId, allSessions);
    
    for (const session of activitySessions) {
      await getCachedMessages(session.id);
    }
    
    sessionStats = aggregateSessionStats(activitySessions, messagesCache);
  }

  return {
    sessions: sessionsWithAgent,
    activeSession,
    planProgress,
    messages,
    activitySessions,
    sessionStats,
    lastUpdate: now,
  };
}
