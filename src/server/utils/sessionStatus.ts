/**
 * Session Status Utility
 * Determines session status based on message timestamps and tool call state
 */

import type { MessageMeta, PartMeta, SessionStatus } from "../../shared/types";

export type { SessionStatus };

// Thresholds in milliseconds
const WORKING_THRESHOLD = 30 * 1000; // 30 seconds
const COMPLETED_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const GRACE_PERIOD = 5 * 1000; // 5 seconds

/**
 * Determine session status based on messages and optional pending tool calls
 * 
 * @param messages - Array of messages from the session (should be sorted by createdAt desc)
 * @param hasPendingToolCall - Whether the session has a pending tool call
 * @param lastToolCompletedAt - Timestamp of last completed tool (for grace period)
 * @param workingChildCount - Number of working child sessions (for waiting state)
 * @param lastAssistantFinished - Whether the last assistant message has finish="stop" (completed turn)
 * @param isSubagent - Whether this is a subagent (has parentID). Subagents cannot wait for user input.
 * @returns SessionStatus: 'working' | 'idle' | 'completed' | 'waiting'
 * 
 * Status precedence:
 * 1. pending tool call → "working"
 * 2. working children → "waiting"
 * 3. assistant finished turn (finish="stop") → "waiting" (root only) or "completed" (subagent)
 * 4. grace period (< 5s after tool completion) → "working"
 * 5. time-based (message age) → "working" | "idle" | "completed"
 */
export function getSessionStatus(
  messages: MessageMeta[],
  hasPendingToolCall: boolean = false,
  lastToolCompletedAt?: Date,
  workingChildCount?: number,
  lastAssistantFinished?: boolean,
  isSubagent: boolean = false
): SessionStatus {
  // Priority 1: Pending tool call overrides everything
  if (hasPendingToolCall) {
    return "working";
  }

  // Priority 2: Parent with working children is waiting
  if (workingChildCount && workingChildCount > 0) {
    return "waiting";
  }

  // Priority 3: Assistant finished turn
  // Only root agents can wait for user input. Subagents are "completed" when they finish.
  if (lastAssistantFinished) {
    return isSubagent ? "completed" : "waiting";
  }

  // Priority 3: Grace period after tool completion
  if (lastToolCompletedAt) {
    const now = Date.now();
    const timeSinceToolCompleted = now - lastToolCompletedAt.getTime();
    if (timeSinceToolCompleted < GRACE_PERIOD) {
      return "working";
    }
  }

  // Priority 4: Time-based status from message timestamps
  // No messages = completed (nothing happening)
  if (!messages || messages.length === 0) {
    return "completed";
  }

  // Find the most recent message
  const lastMessage = messages.reduce((latest, msg) => 
    msg.createdAt.getTime() > latest.createdAt.getTime() ? msg : latest
  );

  const now = Date.now();
  const timeSinceLastMessage = now - lastMessage.createdAt.getTime();

  if (timeSinceLastMessage < WORKING_THRESHOLD) {
    return "working";
  } else if (timeSinceLastMessage < COMPLETED_THRESHOLD) {
    return "idle";
  } else {
    return "completed";
  }
}

/**
 * Check if a part represents a pending tool call
 */
export function isPendingToolCall(part: PartMeta): boolean {
  return part.type === "tool" && part.state === "pending";
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
