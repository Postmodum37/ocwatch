import type { 
  SessionMetadata, 
  MessageMeta, 
  ActivitySession, 
  SessionStatus, 
  TreeNode, 
  TreeEdge, 
  SessionTree, 
  AgentPhase 
} from "../../shared/types";
import { listMessages } from "../storage/messageParser";
import { 
  getPartsForSession, 
  getSessionToolState, 
  isPendingToolCall, 
  getToolCallsForSession, 
  formatCurrentAction 
} from "../storage/partParser";
import { getSessionStatus, getStatusFromTimestamp } from "../utils/sessionStatus";

export function isAssistantFinished(messages: MessageMeta[]): boolean {
  const assistantMessages = messages.filter(m => m.role === "assistant");
  if (assistantMessages.length === 0) return false;
  const lastAssistant = assistantMessages.reduce((a, b) => 
    a.createdAt.getTime() > b.createdAt.getTime() ? a : b
  );
  return lastAssistant.finish === "stop";
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

  async function processSession(sessionID: string) {
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
      await processSession(session.parentID);
    }

    const children = allSessions.filter((s) => s.parentID === sessionID);
    for (const child of children) {
      edges.push({
        source: sessionID,
        target: child.id,
      });
      await processSession(child.id);
    }
  }

  await processSession(rootSessionID);

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
    const firstAssistantMsg = rootMessages
      .filter((m) => m.role === "assistant")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    
    const totalTokens = rootMessages
      .filter((m) => m.tokens !== undefined)
      .reduce((sum, m) => sum + (m.tokens || 0), 0);

    const parts = await getPartsForSession(rootSessionId);
    const toolState = getSessionToolState(parts);
    
    let workingChildCount = 0;
    for (const child of childSessions) {
      const childMessages = await listMessages(child.id);
      const childParts = await getPartsForSession(child.id);
      const childToolState = getSessionToolState(childParts);
      const childLastAssistantFinished = isAssistantFinished(childMessages);
      const childStatus = getSessionStatus(
        childMessages,
        childToolState.hasPendingToolCall,
        childToolState.lastToolCompletedAt || undefined,
        undefined,
        childLastAssistantFinished,
        true
      );
      if (childStatus === "working") {
        workingChildCount++;
      }
    }

    const rootLastAssistantFinished = isAssistantFinished(rootMessages);
    const status = getSessionStatus(
      rootMessages,
      toolState.hasPendingToolCall,
      toolState.lastToolCompletedAt || undefined,
      workingChildCount,
      rootLastAssistantFinished
    );

    let currentAction: string | null = null;
    if (status === "working") {
      const pendingParts = parts.filter(p => isPendingToolCall(p));
      if (pendingParts.length > 0) {
        currentAction = formatCurrentAction(pendingParts[0]);
      }
    }

    const toolCalls = await getToolCallsForSession(rootSessionId, messageAgent);

    result.push({
      id: rootSession.id,
      title: rootSession.title,
      agent: firstAssistantMsg?.agent || "unknown",
      modelID: firstAssistantMsg?.modelID,
      providerID: firstAssistantMsg?.providerID,
      parentID: rootSession.parentID,
      tokens: totalTokens > 0 ? totalTokens : undefined,
      status,
      currentAction,
      toolCalls,
      createdAt: rootSession.createdAt,
      updatedAt: rootSession.updatedAt,
    });
    processed.add(rootSessionId);

    for (const child of childSessions) {
      await processChildSession(child.id, rootSession.id, allSessions, result, processed);
    }
  } else {
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const nextPhaseStart = phases[i + 1]?.startTime || new Date(8640000000000000);
      const virtualId = `${rootSessionId}-phase-${i}-${phase.agent}`;

      const phaseMessages = rootMessages.filter(
        m => m.role === 'assistant' && m.agent === phase.agent &&
             m.createdAt >= phase.startTime && m.createdAt <= phase.endTime
      );
      const firstPhaseMsg = phaseMessages[0];

      const phaseChildren = childSessions.filter(child =>
        child.createdAt >= phase.startTime && child.createdAt < nextPhaseStart
      );

      let workingChildCount = 0;
      for (const child of phaseChildren) {
        const childMessages = await listMessages(child.id);
        const childParts = await getPartsForSession(child.id);
        const childToolState = getSessionToolState(childParts);
        const childLastAssistantFinished = isAssistantFinished(childMessages);
        const childStatus = getSessionStatus(
          childMessages,
          childToolState.hasPendingToolCall,
          childToolState.lastToolCompletedAt || undefined,
          undefined,
          childLastAssistantFinished,
          true
        );
        if (childStatus === "working") {
          workingChildCount++;
        }
      }

      const phaseLastAssistantFinished = isAssistantFinished(phaseMessages);
      const isLastPhase = i === phases.length - 1;
      const status = workingChildCount > 0 
        ? "waiting" 
        : (phaseLastAssistantFinished 
            ? (isLastPhase ? "waiting" : "completed") 
            : getStatusFromTimestamp(phase.endTime));

      const allToolCalls = await getToolCallsForSession(rootSessionId, messageAgent);
      const toolCalls = allToolCalls.filter(tc => tc.agentName === phase.agent);

      result.push({
        id: virtualId,
        title: rootSession.title,
        agent: phase.agent,
        modelID: firstPhaseMsg?.modelID,
        providerID: firstPhaseMsg?.providerID,
        parentID: undefined,
        tokens: phase.tokens > 0 ? phase.tokens : undefined,
        status,
        currentAction: null,
        toolCalls,
        createdAt: phase.startTime,
        updatedAt: phase.endTime,
      });

      for (const child of phaseChildren) {
        await processChildSession(child.id, virtualId, allSessions, result, processed);
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
  processed: Set<string>
): Promise<void> {
  if (processed.has(sessionId)) return;
  processed.add(sessionId);

  const session = allSessions.find((s) => s.id === sessionId);
  if (!session) return;

  const messages = await listMessages(sessionId);
  const firstAssistantMsg = messages
    .filter((m) => m.role === "assistant")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

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
  const toolState = getSessionToolState(parts);
  
  const childSessions = allSessions.filter((s) => s.parentID === sessionId);
  let workingChildCount = 0;
  
  for (const child of childSessions) {
    const childMessages = await listMessages(child.id);
    const childParts = await getPartsForSession(child.id);
    const childToolState = getSessionToolState(childParts);
    const childLastAssistantFinished = isAssistantFinished(childMessages);
    const childStatus = getSessionStatus(
      childMessages,
      childToolState.hasPendingToolCall,
      childToolState.lastToolCompletedAt || undefined,
      undefined,
      childLastAssistantFinished,
      true
    );
    if (childStatus === "working") {
      workingChildCount++;
    }
  }

  const lastAssistantFinished = isAssistantFinished(messages);
  const status = getSessionStatus(
    messages,
    toolState.hasPendingToolCall,
    toolState.lastToolCompletedAt || undefined,
    workingChildCount,
    lastAssistantFinished,
    true
  );

  let currentAction: string | null = null;
  if (status === "working") {
    const pendingParts = parts.filter(p => isPendingToolCall(p));
    if (pendingParts.length > 0) {
      currentAction = formatCurrentAction(pendingParts[0]);
    }
  }

  const toolCalls = await getToolCallsForSession(sessionId, messageAgent);

  result.push({
    id: session.id,
    title: session.title,
    agent: firstAssistantMsg?.agent || "unknown",
    modelID: firstAssistantMsg?.modelID,
    providerID: firstAssistantMsg?.providerID,
    parentID: parentId,
    tokens: totalTokens > 0 ? totalTokens : undefined,
    status,
    currentAction,
    toolCalls,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });

  for (const child of childSessions) {
    await processChildSession(child.id, session.id, allSessions, result, processed);
  }
}
