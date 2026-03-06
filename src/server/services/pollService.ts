import { createHash } from "node:crypto";
import type {
  PollResponse,
  SessionSummary,
  SessionDetail,
  SessionMetadata,
  MessageMeta,
  PlanProgress,
  ActivitySession,
  PartMeta,
  TodoItem,
  SessionActivityResponse,
} from "../../shared/types";
import { parseBoulder, calculatePlanProgress } from "../storage/boulderParser";
import {
  checkDbExists,
  queryMaxTimestamp,
  queryMessages,
  queryParts,
  queryMessagesForSessions,
  queryPartsForSessions,
  querySessions,
  querySessionSubtree,
  querySessionSubtreeRevision,
  queryTodos,
} from "../storage";
import {
  getSessionActivityState,
  generateActivityMessage,
  deriveActivityType,
  getSessionStatusInfo,
  isAssistantFinished,
} from "../logic";
import { resolveProjectDirectory } from "../utils/projectResolver";
import { createSessionContext } from "./sessionContext";
import { getSessionHierarchy } from "./sessionService";
import { aggregateSessionStats } from "./statsService";
import {
  toSessionMetadata,
  toMessageMeta,
  toPartMeta,
  getLatestAssistantMessage,
  getMostRecentPendingPart,
} from "./parsing";
import { selectRecentRootSessions } from "./recentSessions";
import {
  MAX_SESSIONS_LIMIT,
  MAX_MESSAGES_LIMIT,
  POLL_CACHE_TTL_MS,
  SESSION_SCAN_LIMIT,
  MESSAGE_SCAN_LIMIT,
} from "../../shared/constants";

interface IncrementalPollState {
  sessionsById: Map<string, SessionMetadata>;
  messagesBySessionId: Map<string, MessageMeta[]>;
  partsBySessionId: Map<string, PartMeta[]>;
  lastTimestamp: number;
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
    activeSessionId: data.activeSessionId,
    planProgress: data.planProgress,
  };
  const hash = createHash("sha256").update(JSON.stringify(dataForHash)).digest("hex");
  return `"${hash.substring(0, 16)}"`;
}

export function generateSessionActivityETag(data: SessionActivityResponse): string {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        revision: data.revision,
        session: data.session,
        activity: data.activity,
        stats: data.stats,
      }),
    )
    .digest("hex");
  return `"${hash.substring(0, 16)}"`;
}

type PollCacheEntry = { data: PollResponse; etag: string; timestamp: number };
type SessionActivityCacheEntry = { data: SessionActivityResponse; etag: string };

const pollCacheMap = new Map<string, PollCacheEntry>();
const pollInProgressMap = new Map<string, Promise<PollResponse>>();
const sessionActivityCacheMap = new Map<string, SessionActivityCacheEntry>();
const sessionActivityInProgressMap = new Map<string, Promise<SessionActivityResponse>>();
const incrementalPollStateMap = new Map<string, IncrementalPollState>();
const MAX_INCREMENTAL_STATE_ENTRIES = 10;
let pollCacheEpoch = 0;

function cacheKey(projectId?: string): string {
  return projectId ?? "";
}

function sessionActivityCacheKey(sessionId: string): string {
  return sessionId;
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
  sessionActivityCacheMap.clear();
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

export function getSessionActivityCache(sessionId: string): SessionActivityCacheEntry | null {
  return sessionActivityCacheMap.get(sessionActivityCacheKey(sessionId)) ?? null;
}

export function setSessionActivityCache(sessionId: string, cache: SessionActivityCacheEntry | null) {
  const key = sessionActivityCacheKey(sessionId);
  if (cache) {
    sessionActivityCacheMap.set(key, cache);
  } else {
    sessionActivityCacheMap.delete(key);
  }
}

export function getSessionActivityInProgress(sessionId: string): Promise<SessionActivityResponse> | null {
  return sessionActivityInProgressMap.get(sessionActivityCacheKey(sessionId)) ?? null;
}

export function setSessionActivityInProgress(sessionId: string, promise: Promise<SessionActivityResponse> | null) {
  const key = sessionActivityCacheKey(sessionId);
  if (promise) {
    sessionActivityInProgressMap.set(key, promise);
  } else {
    sessionActivityInProgressMap.delete(key);
  }
}

export function getPollCacheTTL() {
  return POLL_CACHE_TTL_MS;
}

function getIncrementalState(projectId?: string): IncrementalPollState {
  const key = cacheKey(projectId);
  const existing = incrementalPollStateMap.get(key);
  if (existing) {
    return existing;
  }

  // Evict oldest entry if at capacity
  if (incrementalPollStateMap.size >= MAX_INCREMENTAL_STATE_ENTRIES) {
    let oldestKey: string | undefined;
    let oldestTimestamp = Infinity;
    for (const [k, v] of incrementalPollStateMap) {
      if (v.lastTimestamp < oldestTimestamp) {
        oldestTimestamp = v.lastTimestamp;
        oldestKey = k;
      }
    }
    if (oldestKey !== undefined) {
      incrementalPollStateMap.delete(oldestKey);
    }
  }

  const created: IncrementalPollState = {
    sessionsById: new Map(),
    messagesBySessionId: new Map(),
    partsBySessionId: new Map(),
    lastTimestamp: 0,
  };
  incrementalPollStateMap.set(key, created);
  return created;
}

function sortMessagesDescending(messages: MessageMeta[]): MessageMeta[] {
  return [...messages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function groupMessagesBySession(rows: ReturnType<typeof queryMessagesForSessions>): Map<string, MessageMeta[]> {
  const grouped = new Map<string, MessageMeta[]>();

  for (const row of rows) {
    const parsed = toMessageMeta(row);
    const existing = grouped.get(parsed.sessionID);
    if (existing) {
      existing.push(parsed);
    } else {
      grouped.set(parsed.sessionID, [parsed]);
    }
  }

  return grouped;
}

function groupPartsBySession(rows: ReturnType<typeof queryPartsForSessions>): Map<string, PartMeta[]> {
  const grouped = new Map<string, PartMeta[]>();

  for (const row of rows) {
    const parsed = toPartMeta(row);
    const existing = grouped.get(parsed.sessionID);
    if (existing) {
      existing.push(parsed);
    } else {
      grouped.set(parsed.sessionID, [parsed]);
    }
  }

  return grouped;
}

function loadMessagesForSession(state: IncrementalPollState, sessionId: string, forceRefresh = false): MessageMeta[] {
  if (!forceRefresh) {
    const cached = state.messagesBySessionId.get(sessionId);
    if (cached) {
      return cached;
    }
  }

  const messages = queryMessages(sessionId, MESSAGE_SCAN_LIMIT).map(toMessageMeta);
  const sorted = sortMessagesDescending(messages);
  state.messagesBySessionId.set(sessionId, sorted);
  return sorted;
}

function loadPartsForSession(state: IncrementalPollState, sessionId: string, forceRefresh = false): PartMeta[] {
  if (!forceRefresh) {
    const cached = state.partsBySessionId.get(sessionId);
    if (cached) {
      return cached;
    }
  }

  const parts = queryParts(sessionId).map(toPartMeta);
  state.partsBySessionId.set(sessionId, parts);
  return parts;
}

function updateIncrementalState(state: IncrementalPollState, projectId?: string): void {
  const currentMaxTimestamp = queryMaxTimestamp();
  const hasBaseline = state.sessionsById.size > 0;
  const hasIncrementalWindow = hasBaseline && currentMaxTimestamp > state.lastTimestamp;

  let refreshAllSessions = !hasBaseline;
  const changedSessionIds = new Set<string>();

  if (hasIncrementalWindow) {
    const changedSessions = querySessions(projectId, state.lastTimestamp, SESSION_SCAN_LIMIT);
    if (changedSessions.length === 0) {
      refreshAllSessions = true;
    } else {
      for (const row of changedSessions) {
        const session = toSessionMetadata(row);
        state.sessionsById.set(session.id, session);
        changedSessionIds.add(session.id);
      }
    }
  }

  if (refreshAllSessions) {
    state.sessionsById.clear();
    const allRows = querySessions(projectId, undefined, SESSION_SCAN_LIMIT);
    for (const row of allRows) {
      const session = toSessionMetadata(row);
      state.sessionsById.set(session.id, session);
      changedSessionIds.add(session.id);
    }

    const activeSessionIds = new Set(state.sessionsById.keys());
    for (const sessionKey of state.messagesBySessionId.keys()) {
      if (!activeSessionIds.has(sessionKey)) {
        state.messagesBySessionId.delete(sessionKey);
      }
    }
    for (const sessionKey of state.partsBySessionId.keys()) {
      if (!activeSessionIds.has(sessionKey)) {
        state.partsBySessionId.delete(sessionKey);
      }
    }
  }

  const wasFirstLoad = !hasBaseline || refreshAllSessions;
  if (!wasFirstLoad && changedSessionIds.size > 0) {
    for (const sessionId of changedSessionIds) {
      loadMessagesForSession(state, sessionId, true);
      loadPartsForSession(state, sessionId, true);
    }
  }

  state.lastTimestamp = currentMaxTimestamp;
}

export async function fetchPollData(projectId?: string): Promise<PollResponse> {
  const dbExists = checkDbExists();
  if (!dbExists) {
    incrementalPollStateMap.delete(cacheKey(projectId));
    return {
      sessions: [],
      activeSessionId: null,
      planProgress: null,
      lastUpdate: Date.now(),
    };
  }

  const state = getIncrementalState(projectId);
  updateIncrementalState(state, projectId);

  const scopedSessions = Array.from(state.sessionsById.values());
  let selectedProjectDirectory: string | null = null;

  if (projectId) {
    selectedProjectDirectory = await resolveProjectDirectory(projectId, scopedSessions);
  }

  const now = Date.now();

  const rootSessions = selectRecentRootSessions(scopedSessions, MAX_SESSIONS_LIMIT);

  function getCachedMessages(id: string): MessageMeta[] {
    const cached = state.messagesBySessionId.get(id);
    if (cached) return cached;
    return loadMessagesForSession(state, id);
  }

  function getCachedParts(id: string): PartMeta[] {
    return loadPartsForSession(state, id);
  }

  const sessionsWithAgent = await Promise.all(
    rootSessions.map(async (session) => {
      const messages = getCachedMessages(session.id);
      const latestAssistantMsg = getLatestAssistantMessage(messages);
      const parts = getCachedParts(session.id);
      const activityState = getSessionActivityState(parts);
      const lastAssistantFinished = isAssistantFinished(messages);

      const statusInfo = getSessionStatusInfo(
        messages,
        activityState.hasPendingToolCall,
        activityState.lastToolCompletedAt || undefined,
        undefined,
        lastAssistantFinished,
      );
      const status = statusInfo.status;

      const pendingPart = getMostRecentPendingPart(parts);
      const currentAction = generateActivityMessage(
        activityState,
        lastAssistantFinished,
        false,
        status,
        pendingPart,
        statusInfo.waitingReason,
      );

      const activityType = deriveActivityType(
        activityState,
        lastAssistantFinished,
        false,
        status,
        statusInfo.waitingReason,
      );

      return {
        ...session,
        agent: latestAssistantMsg?.agent || null,
        modelID: latestAssistantMsg?.modelID || null,
        providerID: latestAssistantMsg?.providerID || null,
        status,
        activityType,
        currentAction,
      };
    }),
  );

  const activeEnriched = [...sessionsWithAgent].sort((a, b) => {
    const priorityDiff = sessionPriority(b) - sessionPriority(a);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0];

  const activeSessionId =
    activeEnriched && sessionPriority(activeEnriched) > 0 ? activeEnriched.id : null;

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
      console.warn("Failed to parse boulder.json:", err instanceof Error ? err.message : err);
    }
  }

  const sessions: SessionSummary[] = sessionsWithAgent.map((s) => ({
    id: s.id,
    projectID: s.projectID,
    title: s.title,
    status: s.status,
    activityType: s.activityType,
    currentAction: s.currentAction,
    agent: s.agent,
    modelID: s.modelID,
    providerID: s.providerID,
    updatedAt: s.updatedAt,
    createdAt: s.createdAt,
  }));

  return {
    sessions,
    activeSessionId,
    planProgress,
    planName,
    lastUpdate: now,
  };
}

async function buildSessionActivityResponse(sessionId: string): Promise<{
  graph: SessionActivityResponse;
  messagesBySession: Map<string, MessageMeta[]>;
}> {
  const allSessions = querySessionSubtree(sessionId).map(toSessionMetadata);
  const sessionIds = allSessions.map((session) => session.id);
  const messagesBySession = groupMessagesBySession(
    queryMessagesForSessions(sessionIds, MESSAGE_SCAN_LIMIT),
  );
  const partsBySession = groupPartsBySession(queryPartsForSessions(sessionIds));
  const context = createSessionContext(allSessions, {
    messagesBySession,
    partsBySession,
  });

  for (const session of allSessions) {
    if (!messagesBySession.has(session.id)) {
      messagesBySession.set(session.id, []);
    }
    if (!partsBySession.has(session.id)) {
      partsBySession.set(session.id, []);
    }
  }

  const activity: ActivitySession[] = await getSessionHierarchy(sessionId, allSessions, context);
  const stats = aggregateSessionStats(activity, messagesBySession);
  const sessionMeta = allSessions.find((session) => session.id === sessionId);
  const rootActivity =
    activity.find((activitySession) => activitySession.id === sessionId) ??
    activity.filter((activitySession) => activitySession.id.startsWith(`${sessionId}-phase-`)).pop();

  const session: SessionSummary = {
    id: sessionId,
    projectID: sessionMeta?.projectID ?? "",
    title: sessionMeta?.title ?? sessionId,
    status: rootActivity?.status,
    activityType: rootActivity?.activityType,
    currentAction: rootActivity?.currentAction,
    agent: rootActivity?.agent ?? null,
    modelID: rootActivity?.modelID ?? null,
    providerID: rootActivity?.providerID ?? null,
    updatedAt: sessionMeta?.updatedAt ?? new Date(),
    createdAt: sessionMeta?.createdAt ?? new Date(),
  };

  return {
    graph: {
      session,
      activity,
      stats,
      revision: querySessionSubtreeRevision(sessionId),
    },
    messagesBySession,
  };
}

export async function fetchSessionActivity(sessionId: string): Promise<SessionActivityResponse> {
  return (await buildSessionActivityResponse(sessionId)).graph;
}

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail> {
  const { graph, messagesBySession } = await buildSessionActivityResponse(sessionId);

  const todos: TodoItem[] = queryTodos(sessionId).map((row) => ({
    content: row.content,
    status: row.status,
    priority: row.priority,
    position: row.position,
  }));

  const messages = (messagesBySession.get(sessionId) ?? []).slice(0, MAX_MESSAGES_LIMIT);

  return {
    session: graph.session,
    messages,
    activity: graph.activity,
    todos,
    stats: graph.stats ?? undefined,
  };
}
