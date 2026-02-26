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
} from "../../shared/types";
import { parseBoulder, calculatePlanProgress } from "../storage/boulderParser";
import {
  checkDbExists,
  queryMaxTimestamp,
  queryMessages,
  queryParts,
  querySessions,
  queryTodos,
} from "../storage";
import {
  getSessionActivityState,
  isPendingToolCall,
  generateActivityMessage,
  deriveActivityType,
  getSessionStatusInfo,
  isAssistantFinished,
} from "../logic";
import { resolveProjectDirectory } from "../utils/projectResolver";
import { getSessionHierarchy } from "./sessionService";
import { aggregateSessionStats } from "./statsService";
import {
  TWENTY_FOUR_HOURS_MS,
  MAX_SESSIONS_LIMIT,
  MAX_MESSAGES_LIMIT,
  POLL_CACHE_TTL_MS,
} from "../../shared/constants";

const SESSION_SCAN_LIMIT = 50_000;
const MESSAGE_SCAN_LIMIT = 10_000;

interface MessageJSON {
  role?: string;
  agent?: string;
  mode?: string;
  modelID?: string;
  providerID?: string;
  model?: {
    modelID?: string;
    providerID?: string;
  };
  parentID?: string;
  cost?: number;
  tokens?: {
    input?: number;
    output?: number;
  };
  finish?: string;
  time?: {
    created?: number;
  };
}

interface PartStateJSON {
  status?: string;
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  title?: string;
  time?: {
    start?: number;
    end?: number;
  };
}

interface PartJSON {
  type?: string;
  callID?: string;
  tool?: string;
  state?: string | PartStateJSON;
  text?: string;
  title?: string;
  reason?: string;
  files?: unknown;
  input?: Record<string, unknown>;
  time?: {
    start?: number;
    end?: number;
  };
  snapshot?: string;
}

interface IncrementalPollState {
  sessionsById: Map<string, SessionMetadata>;
  messagesBySessionId: Map<string, MessageMeta[]>;
  partsBySessionId: Map<string, PartMeta[]>;
  lastTimestamp: number;
}

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

function parseJsonData<T>(raw: unknown): T | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  if (raw && typeof raw === "object") {
    return raw as T;
  }

  return null;
}

function toSessionMetadata(row: {
  id: string;
  projectID: string;
  parentID: string | null;
  directory: string;
  title: string;
  timeCreated: number;
  timeUpdated: number;
}): SessionMetadata {
  return {
    id: row.id,
    projectID: row.projectID,
    directory: row.directory,
    title: row.title,
    parentID: row.parentID ?? undefined,
    createdAt: new Date(row.timeCreated),
    updatedAt: new Date(row.timeUpdated),
  };
}

export function toMessageMeta(row: {
  id: string;
  sessionID: string;
  role: string | null;
  data: string;
  timeCreated: number;
}): MessageMeta {
  const json = parseJsonData<MessageJSON>(row.data) ?? {};
  const tokenInput = json.tokens?.input;
  const tokenOutput = json.tokens?.output;
  const hasTokens = typeof tokenInput === "number" || typeof tokenOutput === "number";

  return {
    id: row.id,
    sessionID: row.sessionID,
    role: json.role ?? row.role ?? "unknown",
    agent: json.agent,
    mode: json.mode,
    modelID: json.modelID ?? json.model?.modelID,
    providerID: json.providerID ?? json.model?.providerID,
    parentID: json.parentID,
    tokens: hasTokens ? (tokenInput ?? 0) + (tokenOutput ?? 0) : undefined,
    cost: typeof json.cost === "number" ? json.cost : undefined,
    createdAt: new Date(json.time?.created ?? row.timeCreated),
    finish: json.finish,
  };
}

function toPartMeta(row: {
  id: string;
  messageID: string;
  sessionID: string;
  type: string | null;
  tool: string | null;
  state: string | null;
  data: string;
}): PartMeta {
  const json = parseJsonData<PartJSON>(row.data) ?? {};

  let state = row.state ?? undefined;
  let input: Record<string, unknown> | undefined;
  let title = json.title;

  if (typeof json.state === "string") {
    state = json.state;
  } else if (json.state && typeof json.state === "object") {
    state = json.state.status ?? state;
    title = json.state.title ?? title;
    if (json.state.input && typeof json.state.input === "object") {
      input = { ...json.state.input };
    }
  }

  if (!input && json.input && typeof json.input === "object") {
    input = { ...json.input };
  }

  let error: string | undefined;
  if (state === "error" || state === "failed") {
    if (json.state && typeof json.state === "object") {
      const text = json.state.error ?? json.state.output;
      if (text && typeof text === "string") {
        error = text.length > 500 ? text.slice(0, 500) : text;
      }
    }
  }

  let startedAt: Date | undefined;
  let completedAt: Date | undefined;
  if (json.time) {
    if (typeof json.time.start === "number") {
      startedAt = new Date(json.time.start);
    }
    if (typeof json.time.end === "number") {
      completedAt = new Date(json.time.end);
    }
  } else if (json.state && typeof json.state === "object" && json.state.time) {
    if (typeof json.state.time.start === "number") {
      startedAt = new Date(json.state.time.start);
    }
    if (typeof json.state.time.end === "number") {
      completedAt = new Date(json.state.time.end);
    }
  }

  const patchFiles = Array.isArray(json.files)
    ? json.files.filter((file): file is string => typeof file === "string")
    : undefined;

  return {
    id: row.id,
    sessionID: row.sessionID,
    messageID: row.messageID,
    type: json.type ?? row.type ?? "unknown",
    callID: json.callID,
    tool: json.tool ?? row.tool ?? undefined,
    state,
    input,
    title,
    error,
    startedAt,
    completedAt,
    stepSnapshot: json.snapshot,
    stepFinishReason: json.reason === "stop" || json.reason === "tool-calls" ? json.reason : undefined,
    reasoningText: (json.type ?? row.type) === "reasoning" ? json.text : undefined,
    patchFiles,
  };
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

type PollCacheEntry = { data: PollResponse; etag: string; timestamp: number };

const pollCacheMap = new Map<string, PollCacheEntry>();
const pollInProgressMap = new Map<string, Promise<PollResponse>>();
const incrementalPollStateMap = new Map<string, IncrementalPollState>();
let pollCacheEpoch = 0;

function cacheKey(projectId?: string): string {
  return projectId ?? "";
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

function getIncrementalState(projectId?: string): IncrementalPollState {
  const key = cacheKey(projectId);
  const existing = incrementalPollStateMap.get(key);
  if (existing) {
    return existing;
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

  if (changedSessionIds.size > 0) {
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
  const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;

  const recentSessions = scopedSessions.filter((session) => session.updatedAt.getTime() >= twentyFourHoursAgo);
  const sortedSessions = recentSessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const limitedSessions = sortedSessions.slice(0, MAX_SESSIONS_LIMIT);
  const rootSessions = limitedSessions.filter((session) => !session.parentID);

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
      console.debug("Failed to parse boulder.json:", err instanceof Error ? err.message : err);
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

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail> {
  // Get all sessions for hierarchy context
  const allSessions = querySessions(undefined, undefined, SESSION_SCAN_LIMIT).map(toSessionMetadata);

  // Get messages for this session
  const messages = queryMessages(sessionId, MAX_MESSAGES_LIMIT).map(toMessageMeta);

  // Get activity tree (hierarchy)
  const activity: ActivitySession[] = await getSessionHierarchy(sessionId, allSessions);

  // Build messages cache for stats
  const messagesCache = new Map<string, MessageMeta[]>();
  messagesCache.set(sessionId, messages);
  for (const activitySession of activity) {
    if (!messagesCache.has(activitySession.id) && !activitySession.id.includes("-phase-")) {
      const childMessages = queryMessages(activitySession.id, MAX_MESSAGES_LIMIT).map(toMessageMeta);
      messagesCache.set(activitySession.id, childMessages);
    }
  }

  // Get todos
  const todos: TodoItem[] = queryTodos(sessionId).map((row) => ({
    content: row.content,
    status: row.status,
    priority: row.priority,
    position: row.position,
  }));

  // Compute stats
  const stats = aggregateSessionStats(activity, messagesCache);

  // Find the session metadata
  const sessionMeta = allSessions.find((s) => s.id === sessionId);

  // Find the root activity entry for derived status (direct match or last phase)
  const rootActivity =
    activity.find((a) => a.id === sessionId) ??
    activity.filter((a) => a.id.startsWith(`${sessionId}-phase-`)).pop();

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

  return { session, messages, activity, todos, stats };
}
