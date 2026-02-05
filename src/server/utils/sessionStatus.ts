/**
 * Session Status Utility
 * Determines session status based on message timestamps and tool call state
 */

import type { MessageMeta, SessionStatus, SessionActivityType } from "../../shared/types";
import { isPendingToolCall, type SessionActivityState } from "../storage/partParser";

export type { SessionStatus };
export { isPendingToolCall };

// Thresholds in milliseconds
const WORKING_THRESHOLD = 30 * 1000; // 30 seconds
const COMPLETED_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const GRACE_PERIOD = 5 * 1000; // 5 seconds

export function getSessionStatus(
  messages: MessageMeta[],
  hasPendingToolCall: boolean = false,
  lastToolCompletedAt?: Date,
  workingChildCount?: number,
  lastAssistantFinished?: boolean,
  isSubagent: boolean = false
): SessionStatus {
  if (hasPendingToolCall) {
    return "working";
  }

  if (workingChildCount && workingChildCount > 0) {
    return "waiting";
  }

  // Calculate time since last message early (needed for multiple checks)
  let timeSinceLastMessage = Infinity;
  if (messages && messages.length > 0) {
    const lastMessage = messages.reduce((latest, msg) => 
      msg.createdAt.getTime() > latest.createdAt.getTime() ? msg : latest
    );
    timeSinceLastMessage = Date.now() - lastMessage.createdAt.getTime();
  }

  // Assistant finished turn - only applies for RECENT sessions (< 5 min)
  // Old sessions (>= 5 min) fall through to time-based status instead of showing "waiting"
  if (lastAssistantFinished && timeSinceLastMessage < COMPLETED_THRESHOLD) {
    return isSubagent ? "completed" : "waiting";
  }

  // Grace period after tool completion
  if (lastToolCompletedAt) {
    const now = Date.now();
    const timeSinceToolCompleted = now - lastToolCompletedAt.getTime();
    if (timeSinceToolCompleted < GRACE_PERIOD) {
      return "working";
    }
  }

  // Time-based status from message timestamps
  if (!messages || messages.length === 0) {
    return "completed";
  }

  if (timeSinceLastMessage < WORKING_THRESHOLD) {
    return "working";
  } else if (timeSinceLastMessage < COMPLETED_THRESHOLD) {
    return "idle";
  } else {
    return "completed";
  }
}



/**
 * Get status from timestamp directly (for simpler cases)
 * Used when you only have the updatedAt timestamp
 */
export function getStatusFromTimestamp(
  updatedAt: Date,
  hasPendingToolCall: boolean = false
): SessionStatus {
  if (hasPendingToolCall) {
    return "working";
  }

  const now = Date.now();
  const timeSinceUpdate = now - updatedAt.getTime();

  if (timeSinceUpdate < WORKING_THRESHOLD) {
    return "working";
  } else if (timeSinceUpdate < COMPLETED_THRESHOLD) {
    return "idle";
  } else {
    return "completed";
  }
}

export function deriveActivityType(
  activityState: SessionActivityState,
  lastAssistantFinished: boolean,
  isSubagent: boolean,
  status: SessionStatus
): SessionActivityType {
  if (status === "completed") {
    return "idle";
  }

  if (activityState.pendingCount > 0) {
    return "tool";
  }

  if (activityState.isReasoning) {
    return "reasoning";
  }

  if (activityState.patchFilesCount > 0) {
    return "patch";
  }

  if (activityState.stepFinishReason === "tool-calls") {
    return "waiting-tools";
  }

  if (lastAssistantFinished && !isSubagent && status === "waiting") {
    return "waiting-user";
  }

  return "idle";
}
