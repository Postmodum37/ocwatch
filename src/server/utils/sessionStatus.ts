/**
 * Session Status Utility
 * Determines session status based on message timestamps and tool call state
 */

import type { MessageMeta, SessionStatus } from "../../shared/types";
import { isPendingToolCall } from "../logic/activityLogic";
import { getSessionStatusInfo } from "../logic/sessionLogic";

export type { SessionStatus };
export { isPendingToolCall, getSessionStatusInfo };
export type { WaitingReason, SessionStatusInfo } from "../logic/sessionLogic";

// Thresholds in milliseconds
const WORKING_THRESHOLD = 30 * 1000; // 30 seconds
const COMPLETED_THRESHOLD = 5 * 60 * 1000; // 5 minutes
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
