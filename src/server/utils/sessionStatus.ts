/**
 * Session Status Utility
 * Determines session status based on message timestamps and tool call state
 */

import type { MessageMeta, SessionStatus } from "../../shared/types";
import { isPendingToolCall } from "../storage/partParser";

export type { SessionStatus };
export { isPendingToolCall };
export type WaitingReason = "user" | "children";

export interface SessionStatusInfo {
  status: SessionStatus;
  waitingReason?: WaitingReason;
}

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
  return getSessionStatusInfo(
    messages,
    hasPendingToolCall,
    lastToolCompletedAt,
    workingChildCount,
    lastAssistantFinished,
    isSubagent
  ).status;
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
    if (isSubagent) {
      return { status: "completed" };
    }
    return { status: "waiting", waitingReason: "user" };
  }

  // Grace period after tool completion
  if (lastToolCompletedAt) {
    const now = Date.now();
    const timeSinceToolCompleted = now - lastToolCompletedAt.getTime();
    if (timeSinceToolCompleted < GRACE_PERIOD) {
      return { status: "working" };
    }
  }

  // Time-based status from message timestamps
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

