import type { 
  SessionMetadata, 
  MessageMeta, 
  ActivitySession, 
  TreeNode, 
  TreeEdge, 
  SessionTree, 
  AgentPhase,
  PartMeta,
  SessionStatus,
} from "../../shared/types";
import { MAX_RECURSION_DEPTH } from "../../shared/constants";
import { listMessages } from "../storage/messageParser";
import { 
  getPartsForSession, 
  getSessionActivityState,
  isPendingToolCall, 
  getToolCallsForSession, 
  generateActivityMessage
} from "../storage/partParser";
import { getSessionStatus, getSessionStatusInfo, getStatusFromTimestamp, type SessionStatusInfo } from "../utils/sessionStatus";
import { deriveActivityType } from "../storage/partParser";

export function isAssistantFinished(messages: MessageMeta[]): boolean {
  if (messages.length === 0) {
    return false;
  }

  const lastMessage = messages.reduce((latest, current) =>
    current.createdAt.getTime() > latest.createdAt.getTime() ? current : latest
  );

  return lastMessage.role === "assistant" && lastMessage.finish === "stop";
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

function countBlockingChildren(statuses: SessionStatus[]): number {
  return statuses.filter((status) => status === "working" || status === "waiting").length;
}

export function detectAgentPhases(messages: MessageMeta[]): AgentPhase[] {
  const sorted = messages
    .filter(m => m.role === 'assistant' && m.agent)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  
  if (sorted.length === 0) return [];
  
  const phases: AgentPhase[] = [];
  let currentPhase: AgentPhase | null = null;
  
  for (const msg of sorted) {
    if (!currentPhase || currentPhase.agent !== msg.agent) {
      if (currentPhase) phases.push(currentPhase);
      currentPhase = {
        agent: msg.agent!,
        startTime: msg.createdAt,
        endTime: msg.createdAt,
        tokens: msg.tokens || 0,
        messageCount: 1,
      };
    } else {
      currentPhase.endTime = msg.createdAt;
      currentPhase.tokens += msg.tokens || 0;
      currentPhase.messageCount++;
    }
  }
  if (currentPhase) phases.push(currentPhase);
  
  return phases;
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

  async function processSession(sessionID: string, depth = 0) {
    if (depth > MAX_RECURSION_DEPTH) {
      console.warn(`Max recursion depth reached for session ${sessionID}`);
      return;
    }
    if (visited.has(sessionID)) {
      return;
    }
    visited.add(sessionID);

    const session = allSessions.find((s) => s.id === sessionID);
    if (!session) {
      return;
    }

    const messages = await listMessages(sessionID);
    const lastAssistantFinished = isAssistantFinished(messages);
    const isSubagent = !!session.parentID;
    const status = getSessionStatus(messages, false, undefined, undefined, lastAssistantFinished, isSubagent);

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

    const children = allSessions.filter((s) => s.parentID === sessionID);
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

  const rootSession = allSessions.find((s) => s.id === rootSessionId);
  if (!rootSession) return result;

  const rootMessages = await listMessages(rootSessionId);
  const phases = detectAgentPhases(rootMessages);
  const childSessions = allSessions.filter((s) => s.parentID === rootSessionId);

  // Build messageAgent map for tool calls
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

    const parts = await getPartsForSession(rootSessionId);
    const activityState = getSessionActivityState(parts);
    
    const childStatuses = await Promise.all(
      childSessions.map(async (child) => {
        const [childMessages, childParts] = await Promise.all([
          listMessages(child.id),
          getPartsForSession(child.id),
        ]);
        const childActivityState = getSessionActivityState(childParts);
        const childLastAssistantFinished = isAssistantFinished(childMessages);
        return getSessionStatus(
          childMessages,
          childActivityState.hasPendingToolCall,
          childActivityState.lastToolCompletedAt || undefined,
          undefined,
          childLastAssistantFinished,
          true
        );
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

    const toolCalls = await getToolCallsForSession(rootSessionId, messageAgent, undefined, parts);

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
      await processChildSession(child.id, rootSession.id, allSessions, result, processed, 1);
    }
  } else {
    const rootParts = await getPartsForSession(rootSessionId);
    const allToolCalls = await getToolCallsForSession(rootSessionId, messageAgent, undefined, rootParts);

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const nextPhaseStart = phases[i + 1]?.startTime || new Date(8640000000000000);
      const virtualId = `${rootSessionId}-phase-${i}-${phase.agent}`;

      const phaseMessages = rootMessages.filter(
        m => m.role === 'assistant' && m.agent === phase.agent &&
             m.createdAt >= phase.startTime && m.createdAt <= phase.endTime
      );
      const latestPhaseMsg = phaseMessages[phaseMessages.length - 1];

      const phaseChildren = childSessions.filter(child =>
        child.createdAt >= phase.startTime && child.createdAt < nextPhaseStart
      );

      const childStatuses = await Promise.all(
        phaseChildren.map(async (child) => {
          const [childMessages, childParts] = await Promise.all([
            listMessages(child.id),
            getPartsForSession(child.id),
          ]);
          const childActivityState = getSessionActivityState(childParts);
          const childLastAssistantFinished = isAssistantFinished(childMessages);
          return getSessionStatus(
            childMessages,
            childActivityState.hasPendingToolCall,
            childActivityState.lastToolCompletedAt || undefined,
            undefined,
            childLastAssistantFinished,
            true
          );
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

      const toolCalls = allToolCalls.filter(tc => tc.agentName === phase.agent);

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
        await processChildSession(child.id, virtualId, allSessions, result, processed, 1);
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
  depth = 0
): Promise<void> {
  if (depth > MAX_RECURSION_DEPTH) {
    console.warn(`Max recursion depth reached for child session ${sessionId}`);
    return;
  }
  if (processed.has(sessionId)) return;
  processed.add(sessionId);

  const session = allSessions.find((s) => s.id === sessionId);
  if (!session) return;

  const messages = await listMessages(sessionId);
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

  const parts = await getPartsForSession(sessionId);
  const activityState = getSessionActivityState(parts);
  
  const childSessions = allSessions.filter((s) => s.parentID === sessionId);
  const childStatuses = await Promise.all(
    childSessions.map(async (child) => {
      const [childMessages, childParts] = await Promise.all([
        listMessages(child.id),
        getPartsForSession(child.id),
      ]);
      const childActivityState = getSessionActivityState(childParts);
      const childLastAssistantFinished = isAssistantFinished(childMessages);
      return getSessionStatus(
        childMessages,
        childActivityState.hasPendingToolCall,
        childActivityState.lastToolCompletedAt || undefined,
        undefined,
        childLastAssistantFinished,
        true
      );
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

  const toolCalls = await getToolCallsForSession(sessionId, messageAgent, undefined, parts);

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
      processChildSession(child.id, session.id, allSessions, result, processed, depth + 1)
    )
  );
}
