import type {
  SessionMetadata,
  MessageMeta,
  ActivitySession,
  TreeNode,
  TreeEdge,
  SessionTree,
  PartMeta,
  SessionStatus,
  ToolCallSummary,
} from "../../shared/types";
import { MAX_RECURSION_DEPTH } from "../../shared/constants";
import {
  formatCurrentAction,
  isPendingToolCall,
  generateActivityMessage,
  getSessionActivityState,
  deriveActivityType,
  detectAgentPhases,
  isAssistantFinished,
  getSessionStatusInfo,
  type SessionStatusInfo,
} from "../logic";
import {
  querySessionChildren,
  queryMessages,
  queryParts,
} from "../storage/queries";
import { getStatusFromTimestamp } from "../utils/sessionStatus";
import {
  toSessionMetadata as parseSessionRow,
  toMessageMeta as parseMessageRow,
  toPartMeta as parsePartRow,
  getLatestAssistantMessage,
  getMostRecentPendingPart,
} from "./parsing";

export { detectAgentPhases, isAssistantFinished };

/** Max messages to load per session for hierarchy building (effectively unlimited) */
const MAX_MESSAGE_QUERY_LIMIT = 100_000;

interface SessionContext {
  allowedSessionIds: Set<string>;
  sessionById: Map<string, SessionMetadata>;
  messagesBySession: Map<string, MessageMeta[]>;
  partsBySession: Map<string, PartMeta[]>;
  childrenBySession: Map<string, SessionMetadata[]>;
}


function createSessionContext(allSessions: SessionMetadata[]): SessionContext {
  const sessionById = new Map<string, SessionMetadata>();
  for (const session of allSessions) {
    sessionById.set(session.id, session);
  }

  return {
    allowedSessionIds: new Set(allSessions.map((session) => session.id)),
    sessionById,
    messagesBySession: new Map<string, MessageMeta[]>(),
    partsBySession: new Map<string, PartMeta[]>(),
    childrenBySession: new Map<string, SessionMetadata[]>(),
  };
}

function getSessionFromContext(sessionId: string, context: SessionContext): SessionMetadata | undefined {
  return context.sessionById.get(sessionId);
}

function getSessionMessages(sessionId: string, context: SessionContext): MessageMeta[] {
  const cached = context.messagesBySession.get(sessionId);
  if (cached) {
    return cached;
  }

  const messages = queryMessages(sessionId, MAX_MESSAGE_QUERY_LIMIT).map(parseMessageRow);
  context.messagesBySession.set(sessionId, messages);
  return messages;
}

function getSessionParts(sessionId: string, context: SessionContext): PartMeta[] {
  const cached = context.partsBySession.get(sessionId);
  if (cached) {
    return cached;
  }

  const parts = queryParts(sessionId).map(parsePartRow);
  context.partsBySession.set(sessionId, parts);
  return parts;
}

function getSessionChildren(sessionId: string, context: SessionContext): SessionMetadata[] {
  const cached = context.childrenBySession.get(sessionId);
  if (cached) {
    return cached;
  }

  const children = querySessionChildren(sessionId)
    .map(parseSessionRow)
    .filter((child) => context.allowedSessionIds.has(child.id));

  for (const child of children) {
    if (!context.sessionById.has(child.id)) {
      context.sessionById.set(child.id, child);
    }
  }

  context.childrenBySession.set(sessionId, children);
  return children;
}


function countBlockingChildren(statuses: SessionStatus[]): number {
  return statuses.filter((status) => status === "working" || status === "waiting").length;
}


function buildToolCalls(parts: PartMeta[], messageAgent: Map<string, string>): ToolCallSummary[] {
  const toolCalls = parts
    .filter((part) => part.type === "tool" && part.tool)
    .map((part): ToolCallSummary => {
      let state: "pending" | "complete" | "error" = "complete";
      if (isPendingToolCall(part)) {
        state = "pending";
      } else if (part.state === "error" || part.state === "failed") {
        state = "error";
      }

      return {
        id: part.id,
        name: part.tool || "unknown",
        state,
        summary: formatCurrentAction(part) || part.tool || "Unknown tool",
        input: part.input || {},
        error: part.error,
        timestamp: (part.completedAt || part.startedAt)?.toISOString() || "",
        agentName: messageAgent.get(part.messageID) || "unknown",
      };
    });

  toolCalls.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  return toolCalls.slice(0, 50);
}

export function buildAgentHierarchy(messages: MessageMeta[]): Record<string, string[]> {
  const hierarchy: Record<string, string[]> = {};

  for (const msg of messages) {
    if (msg.agent && msg.parentID) {
      const parentMsg = messages.find((m) => m.id === msg.parentID);
      if (parentMsg?.agent) {
        if (!hierarchy[parentMsg.agent]) {
          hierarchy[parentMsg.agent] = [];
        }
        if (!hierarchy[parentMsg.agent].includes(msg.agent)) {
          hierarchy[parentMsg.agent].push(msg.agent);
        }
      }
    }
  }

  return hierarchy;
}

export async function buildSessionTree(
  rootSessionID: string,
  allSessions: SessionMetadata[]
): Promise<SessionTree> {
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  const visited = new Set<string>();
  const context = createSessionContext(allSessions);

  async function processSession(sessionID: string, depth = 0) {
    if (depth > MAX_RECURSION_DEPTH) {
      console.warn(`Max recursion depth reached for session ${sessionID}`);
      return;
    }
    if (visited.has(sessionID)) {
      return;
    }
    visited.add(sessionID);

    const session = getSessionFromContext(sessionID, context);
    if (!session) {
      return;
    }

    const messages = getSessionMessages(sessionID, context);
    const lastAssistantFinished = isAssistantFinished(messages);
    const isSubagent = !!session.parentID;
    const status = getSessionStatusInfo(
      messages,
      false,
      undefined,
      undefined,
      lastAssistantFinished,
      isSubagent
    ).status;

    const lastMessage = messages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0];

    nodes.push({
      id: session.id,
      data: {
        title: session.title,
        agent: lastMessage?.agent,
        model: lastMessage?.modelID,
        isActive: status === "working" || status === "idle",
      },
    });

    if (session.parentID) {
      edges.push({
        source: session.parentID,
        target: session.id,
      });
      await processSession(session.parentID, depth + 1);
    }

    const children = getSessionChildren(sessionID, context);
    await Promise.all(
      children.map((child) => {
        edges.push({
          source: sessionID,
          target: child.id,
        });
        return processSession(child.id, depth + 1);
      })
    );
  }

  await processSession(rootSessionID, 0);

  return { nodes, edges };
}

export async function getSessionHierarchy(
  rootSessionId: string,
  allSessions: SessionMetadata[]
): Promise<ActivitySession[]> {
  const result: ActivitySession[] = [];
  const processed = new Set<string>();
  const context = createSessionContext(allSessions);

  const rootSession = getSessionFromContext(rootSessionId, context);
  if (!rootSession) return result;

  const rootMessages = getSessionMessages(rootSessionId, context);
  const phases = detectAgentPhases(rootMessages);
  const childSessions = getSessionChildren(rootSessionId, context);

  const messageAgent = new Map<string, string>();
  for (const msg of rootMessages) {
    if (msg.agent) {
      messageAgent.set(msg.id, msg.agent);
    }
  }

  if (phases.length <= 1) {
    const latestAssistantMsg = getLatestAssistantMessage(rootMessages);

    const totalTokens = rootMessages
      .filter((m) => m.tokens !== undefined)
      .reduce((sum, m) => sum + (m.tokens || 0), 0);

    const parts = getSessionParts(rootSessionId, context);
    const activityState = getSessionActivityState(parts);

    const childStatuses = await Promise.all(
      childSessions.map(async (child) => {
        const childMessages = getSessionMessages(child.id, context);
        const childParts = getSessionParts(child.id, context);
        const childActivityState = getSessionActivityState(childParts);
        const childLastAssistantFinished = isAssistantFinished(childMessages);
        return getSessionStatusInfo(
          childMessages,
          childActivityState.hasPendingToolCall,
          childActivityState.lastToolCompletedAt || undefined,
          undefined,
          childLastAssistantFinished,
          true
        ).status;
      })
    );
    const workingChildCount = countBlockingChildren(childStatuses);

    const rootLastAssistantFinished = isAssistantFinished(rootMessages);
    const statusInfo = getSessionStatusInfo(
      rootMessages,
      activityState.hasPendingToolCall,
      activityState.lastToolCompletedAt || undefined,
      workingChildCount,
      rootLastAssistantFinished
    );
    const status = statusInfo.status;

    const pendingPart = getMostRecentPendingPart(parts);
    const currentAction = generateActivityMessage(
      activityState,
      rootLastAssistantFinished,
      false,
      status,
      pendingPart,
      statusInfo.waitingReason
    );
    const activityType = deriveActivityType(activityState, rootLastAssistantFinished, false, status, statusInfo.waitingReason);

    const toolCalls = buildToolCalls(parts, messageAgent);

    result.push({
      id: rootSession.id,
      title: rootSession.title,
      agent: latestAssistantMsg?.agent || "unknown",
      modelID: latestAssistantMsg?.modelID,
      providerID: latestAssistantMsg?.providerID,
      parentID: rootSession.parentID,
      tokens: totalTokens > 0 ? totalTokens : undefined,
      status,
      currentAction,
      activityType,
      pendingToolCount: activityState.pendingCount > 0 ? activityState.pendingCount : undefined,
      patchFilesCount: activityState.patchFilesCount > 0 ? activityState.patchFilesCount : undefined,
      toolCalls,
      createdAt: rootSession.createdAt,
      updatedAt: rootSession.updatedAt,
    });
    processed.add(rootSessionId);

    for (const child of childSessions) {
      await processChildSession(child.id, rootSession.id, allSessions, result, processed, 1, context);
    }
  } else {
    const rootParts = getSessionParts(rootSessionId, context);
    const allToolCalls = buildToolCalls(rootParts, messageAgent);

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const nextPhaseStart = phases[i + 1]?.startTime || new Date(8640000000000000);
      const virtualId = `${rootSessionId}-phase-${i}-${phase.agent}`;

      const phaseMessages = rootMessages.filter(
        (m) => m.role === "assistant" && m.agent === phase.agent &&
             m.createdAt >= phase.startTime && m.createdAt <= phase.endTime
      );
      const latestPhaseMsg = phaseMessages[phaseMessages.length - 1];

      const phaseChildren = childSessions.filter((child) =>
        child.createdAt >= phase.startTime && child.createdAt < nextPhaseStart
      );

      const childStatuses = await Promise.all(
        phaseChildren.map(async (child) => {
          const childMessages = getSessionMessages(child.id, context);
          const childParts = getSessionParts(child.id, context);
          const childActivityState = getSessionActivityState(childParts);
          const childLastAssistantFinished = isAssistantFinished(childMessages);
          return getSessionStatusInfo(
            childMessages,
            childActivityState.hasPendingToolCall,
            childActivityState.lastToolCompletedAt || undefined,
            undefined,
            childLastAssistantFinished,
            true
          ).status;
        })
      );
      const workingChildCount = countBlockingChildren(childStatuses);

      const phaseLastAssistantFinished = isAssistantFinished(phaseMessages);
      const isLastPhase = i === phases.length - 1;
      const phaseMessageIds = new Set(phaseMessages.map((message) => message.id));
      const phaseParts = rootParts.filter((part) => phaseMessageIds.has(part.messageID));
      const phaseActivityState = getSessionActivityState(phaseParts);

      const statusInfo: SessionStatusInfo = isLastPhase
        ? getSessionStatusInfo(
            phaseMessages,
            phaseActivityState.hasPendingToolCall,
            phaseActivityState.lastToolCompletedAt || undefined,
            workingChildCount,
            phaseLastAssistantFinished
          )
        : {
            status: workingChildCount > 0
              ? "waiting"
              : (phaseLastAssistantFinished ? "completed" : getStatusFromTimestamp(phase.endTime)),
            waitingReason: workingChildCount > 0 ? "children" : undefined,
          };

      const status = statusInfo.status;

      const pendingPart = isLastPhase ? getMostRecentPendingPart(phaseParts) : undefined;
      const currentAction = isLastPhase
        ? generateActivityMessage(
            phaseActivityState,
            phaseLastAssistantFinished,
            false,
            status,
            pendingPart,
            statusInfo.waitingReason
          )
        : null;
      const activityType = isLastPhase
        ? deriveActivityType(phaseActivityState, phaseLastAssistantFinished, false, status, statusInfo.waitingReason)
        : "idle";

      const toolCalls = allToolCalls.filter((tc) => tc.agentName === phase.agent);

      result.push({
        id: virtualId,
        title: rootSession.title,
        agent: phase.agent,
        modelID: latestPhaseMsg?.modelID,
        providerID: latestPhaseMsg?.providerID,
        parentID: undefined,
        tokens: phase.tokens > 0 ? phase.tokens : undefined,
        status,
        currentAction,
        activityType,
        pendingToolCount: isLastPhase && phaseActivityState.pendingCount > 0 ? phaseActivityState.pendingCount : undefined,
        patchFilesCount: isLastPhase && phaseActivityState.patchFilesCount > 0 ? phaseActivityState.patchFilesCount : undefined,
        toolCalls,
        createdAt: phase.startTime,
        updatedAt: phase.endTime,
      });

      for (const child of phaseChildren) {
        await processChildSession(child.id, virtualId, allSessions, result, processed, 1, context);
      }
    }
  }

  return result;
}

export async function processChildSession(
  sessionId: string,
  parentId: string,
  allSessions: SessionMetadata[],
  result: ActivitySession[],
  processed: Set<string>,
  depth = 0,
  contextArg?: SessionContext
): Promise<void> {
  if (depth > MAX_RECURSION_DEPTH) {
    console.warn(`Max recursion depth reached for child session ${sessionId}`);
    return;
  }
  if (processed.has(sessionId)) return;
  processed.add(sessionId);

  const context = contextArg ?? createSessionContext(allSessions);
  const session = getSessionFromContext(sessionId, context);
  if (!session) return;

  const messages = getSessionMessages(sessionId, context);
  const latestAssistantMsg = getLatestAssistantMessage(messages);

  const totalTokens = messages
    .filter((m) => m.tokens !== undefined)
    .reduce((sum, m) => sum + (m.tokens || 0), 0);

  const messageAgent = new Map<string, string>();
  for (const msg of messages) {
    if (msg.agent) {
      messageAgent.set(msg.id, msg.agent);
    }
  }

  const parts = getSessionParts(sessionId, context);
  const activityState = getSessionActivityState(parts);

  const childSessions = getSessionChildren(sessionId, context);
  const childStatuses = await Promise.all(
    childSessions.map(async (child) => {
      const childMessages = getSessionMessages(child.id, context);
      const childParts = getSessionParts(child.id, context);
      const childActivityState = getSessionActivityState(childParts);
      const childLastAssistantFinished = isAssistantFinished(childMessages);
      return getSessionStatusInfo(
        childMessages,
        childActivityState.hasPendingToolCall,
        childActivityState.lastToolCompletedAt || undefined,
        undefined,
        childLastAssistantFinished,
        true
      ).status;
    })
  );
  const workingChildCount = countBlockingChildren(childStatuses);

  const lastAssistantFinished = isAssistantFinished(messages);
  const statusInfo = getSessionStatusInfo(
    messages,
    activityState.hasPendingToolCall,
    activityState.lastToolCompletedAt || undefined,
    workingChildCount,
    lastAssistantFinished,
    true
  );
  const status = statusInfo.status;

  const pendingPart = getMostRecentPendingPart(parts);
  const currentAction = generateActivityMessage(
    activityState,
    lastAssistantFinished,
    true,
    status,
    pendingPart,
    statusInfo.waitingReason
  );
  const activityType = deriveActivityType(activityState, lastAssistantFinished, true, status, statusInfo.waitingReason);

  const toolCalls = buildToolCalls(parts, messageAgent);

  result.push({
    id: session.id,
    title: session.title,
    agent: latestAssistantMsg?.agent || "unknown",
    modelID: latestAssistantMsg?.modelID,
    providerID: latestAssistantMsg?.providerID,
    parentID: parentId,
    tokens: totalTokens > 0 ? totalTokens : undefined,
    status,
    currentAction,
    activityType,
    pendingToolCount: activityState.pendingCount > 0 ? activityState.pendingCount : undefined,
    patchFilesCount: activityState.patchFilesCount > 0 ? activityState.patchFilesCount : undefined,
    toolCalls,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });

  await Promise.all(
    childSessions.map((child) =>
      processChildSession(child.id, session.id, allSessions, result, processed, depth + 1, context)
    )
  );
}
