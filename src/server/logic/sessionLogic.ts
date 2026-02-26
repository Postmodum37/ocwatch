import type { AgentPhase, MessageMeta, SessionStatus } from "../../shared/types";

export type WaitingReason = "user" | "children";

export interface SessionStatusInfo {
  status: SessionStatus;
  waitingReason?: WaitingReason;
}

const WORKING_THRESHOLD = 30 * 1000;
const COMPLETED_THRESHOLD = 5 * 60 * 1000;
const GRACE_PERIOD = 5 * 1000;

export function isAssistantFinished(messages: MessageMeta[]): boolean {
  if (messages.length === 0) {
    return false;
  }

  const lastMessage = messages.reduce((latest, current) =>
    current.createdAt.getTime() > latest.createdAt.getTime() ? current : latest
  );

  return lastMessage.role === "assistant" && lastMessage.finish === "stop";
}

export function detectAgentPhases(messages: MessageMeta[]): AgentPhase[] {
  const sorted = messages
    .filter(m => m.role === "assistant" && m.agent)
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

export function getSessionStatusInfo(
  messages: MessageMeta[],
  hasPendingToolCall: boolean = false,
  lastToolCompletedAt?: Date,
  workingChildCount?: number,
  lastAssistantFinished?: boolean,
  isSubagent: boolean = false
): SessionStatusInfo {
  if (hasPendingToolCall) {
    return { status: "working" };
  }

  if (workingChildCount && workingChildCount > 0) {
    return { status: "waiting", waitingReason: "children" };
  }

  let timeSinceLastMessage = Infinity;
  if (messages && messages.length > 0) {
    const lastMessage = messages.reduce((latest, msg) =>
      msg.createdAt.getTime() > latest.createdAt.getTime() ? msg : latest
    );
    timeSinceLastMessage = Date.now() - lastMessage.createdAt.getTime();
  }

  if (lastAssistantFinished && timeSinceLastMessage < COMPLETED_THRESHOLD) {
    if (isSubagent) {
      return { status: "completed" };
    }
    return { status: "waiting", waitingReason: "user" };
  }

  if (lastToolCompletedAt) {
    const now = Date.now();
    const timeSinceToolCompleted = now - lastToolCompletedAt.getTime();
    if (timeSinceToolCompleted < GRACE_PERIOD) {
      return { status: "working" };
    }
  }

  if (!messages || messages.length === 0) {
    return { status: "completed" };
  }

  if (timeSinceLastMessage < WORKING_THRESHOLD) {
    return { status: "working" };
  } else if (timeSinceLastMessage < COMPLETED_THRESHOLD) {
    return { status: "idle" };
  } else {
    return { status: "completed" };
  }
}
