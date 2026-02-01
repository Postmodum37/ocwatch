/**
 * Session Status Utility
 * Determines session status based on message timestamps and tool call state
 */

import type { MessageMeta, PartMeta } from "../../shared/types";

export type SessionStatus = "working" | "idle" | "completed";

// Thresholds in milliseconds
const WORKING_THRESHOLD = 30 * 1000; // 30 seconds
const COMPLETED_THRESHOLD = 5 * 60 * 1000; // 5 minutes

/**
 * Determine session status based on messages and optional pending tool calls
 * 
 * @param messages - Array of messages from the session (should be sorted by createdAt desc)
 * @param hasPendingToolCall - Whether the session has a pending tool call
 * @returns SessionStatus: 'working' | 'idle' | 'completed'
 * 
 * Logic:
 * - working: has message < 30s old OR has pending tool call
 * - idle: last message 30s-5min old
 * - completed: last message > 5min old (or no messages)
 */
export function getSessionStatus(
  messages: MessageMeta[],
  hasPendingToolCall: boolean = false
): SessionStatus {
  // If there's a pending tool call, session is working regardless of time
  if (hasPendingToolCall) {
    return "working";
  }

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
