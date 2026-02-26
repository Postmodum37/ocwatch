/**
 * Part Parser - Parse OpenCode part JSON files (lazy loading)
 * Reads from ~/.local/share/opencode/storage/part/{partID}.json
 * 
 * IMPORTANT: With 25,748+ part files, this parser uses lazy loading.
 * Only load individual part files on demand, never read all at once.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PartMeta, ToolCallSummary } from "../../shared/types";
import { getStoragePath } from "./sessionParser";
import { listMessages } from "./messageParser";
import { formatCurrentAction, isPendingToolCall } from "../logic/activityLogic";

export {
  TOOL_DISPLAY_NAMES,
  formatCurrentAction,
  isPendingToolCall,
  getSessionActivityState,
  deriveActivityType,
  generateActivityMessage,
  type SessionActivityState,
} from "../logic/activityLogic";

interface PartStateJSON {
  status?: string;
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  title?: string;
  time?: {
    start: number;
    end?: number;
  };
}

interface PartJSON {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
  callID?: string;
  tool?: string;
  state?: string | PartStateJSON;
  text?: string;
  time?: {
    start: number;
    end?: number;
  };
  snapshot?: string;
  reason?: string;
  files?: string[];
  input?: Record<string, unknown>;
}

/**
 * Parse a single part JSON file (lazy loading)
 * @param filePath - Absolute path to part JSON file
 * @returns PartMeta or null if file doesn't exist or is invalid
 */
export async function parsePart(filePath: string): Promise<PartMeta | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const json: PartJSON = JSON.parse(content);

    let state: string | undefined;
    let input: PartMeta["input"];
    let title: string | undefined;

    if (typeof json.state === "string") {
      state = json.state;
    } else if (json.state && typeof json.state === "object") {
      state = json.state.status;
      title = json.state.title;
      if (json.state.input) {
        input = { ...json.state.input };
      }
    }

    if (!input && json.input) {
      input = { ...json.input };
    }

    let error: string | undefined;
    if (state === "error" || state === "failed") {
      if (typeof json.state === "object" && json.state !== null) {
        const errorText = json.state.error || json.state.output;
        if (errorText && typeof errorText === "string") {
          error = errorText.length > 500 ? errorText.slice(0, 500) : errorText;
        }
      }
    }

    // Time can be at top level (json.time) or inside state object (json.state.time) for tool parts
    let timeStart: number | undefined;
    let timeEnd: number | undefined;
    
    if (json.time) {
      timeStart = json.time.start;
      timeEnd = json.time.end;
    } else if (typeof json.state === "object" && json.state !== null && json.state.time) {
      timeStart = json.state.time.start;
      timeEnd = json.state.time.end;
    }
    
    const startedAt = timeStart ? new Date(timeStart) : undefined;
    const completedAt = timeEnd ? new Date(timeEnd) : undefined;

    return {
      id: json.id,
      sessionID: json.sessionID,
      messageID: json.messageID,
      type: json.type,
      callID: json.callID,
      tool: json.tool,
      state,
      input,
      title,
      error,
      startedAt,
      completedAt,
      stepSnapshot: json.snapshot,
      stepFinishReason: json.reason === "stop" || json.reason === "tool-calls" ? json.reason : undefined,
      reasoningText: json.type === "reasoning" ? json.text : undefined,
      patchFiles: json.files,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get a specific part by partID (lazy loading)
 * @param partID - Part ID
 * @param storagePath - Optional custom storage path (defaults to XDG path)
 * @returns PartMeta or null if not found
 */
export async function getPart(
  partID: string,
  storagePath?: string
): Promise<PartMeta | null> {
  const basePath = storagePath || getStoragePath();
  const filePath = join(
    basePath,
    "opencode",
    "storage",
    "part",
    `${partID}.json`
  );

  return parsePart(filePath);
}

export interface SessionToolState {
  hasPendingToolCall: boolean;
  pendingCount: number;
  completedCount: number;
  lastToolCompletedAt: Date | null;
}

export function getSessionToolState(parts: PartMeta[]): SessionToolState {
  let pendingCount = 0;
  let completedCount = 0;
  let lastToolCompletedAt: Date | null = null;

  for (const part of parts) {
    if (part.type !== "tool" || !part.tool) {
      continue;
    }

    if (isPendingToolCall(part)) {
      pendingCount++;
    } else if (part.state === "completed") {
      completedCount++;
      
      if (part.completedAt) {
        if (!lastToolCompletedAt || part.completedAt > lastToolCompletedAt) {
          lastToolCompletedAt = part.completedAt;
        }
      }
    }
  }

  return {
    hasPendingToolCall: pendingCount > 0,
    pendingCount,
    completedCount,
    lastToolCompletedAt,
  };
}

export async function getPartsForSession(
  sessionID: string,
  storagePath?: string
): Promise<PartMeta[]> {
  const basePath = storagePath || getStoragePath();
  const messages = await listMessages(sessionID, storagePath);
  const parts: PartMeta[] = [];

  for (const message of messages) {
    const messagePartDir = join(
      basePath,
      "opencode",
      "storage",
      "part",
      message.id
    );

    try {
      const entries = await readdir(messagePartDir);

      for (const entry of entries) {
        if (!entry.endsWith(".json")) {
          continue;
        }

        const partPath = join(messagePartDir, entry);
        const part = await parsePart(partPath);

        if (part) {
          parts.push(part);
        }
      }
    } catch (error) {
      continue;
    }
  }

  return parts;
}

/**
 * Get tool call summaries for a session
 * @param sessionID - Session ID
 * @param messageAgent - Map of message ID to agent name
 * @param storagePath - Optional custom storage path (defaults to XDG path)
 * @returns Array of ToolCallSummary (max 50, sorted by timestamp desc)
 */
export async function getToolCallsForSession(
  sessionID: string,
  messageAgent: Map<string, string>,
  storagePath?: string,
  partsOverride?: PartMeta[]
): Promise<ToolCallSummary[]> {
  const parts = partsOverride ?? (await getPartsForSession(sessionID, storagePath));

  // Filter for tool type parts only
  const toolParts = parts.filter((part) => part.type === "tool" && part.tool);

  // Map to ToolCallSummary
  const toolCalls: ToolCallSummary[] = toolParts.map((part) => {
    const agentName = messageAgent.get(part.messageID) || "unknown";

    // Map state to ToolCallSummary state
    let state: "pending" | "complete" | "error" = "complete";
    if (part.state) {
      if (isPendingToolCall(part)) {
        state = "pending";
      } else if (part.state === "error" || part.state === "failed") {
        state = "error";
      } else {
        state = "complete";
      }
    }

    // Generate summary using formatCurrentAction
    const summary = formatCurrentAction(part) || part.tool || "Unknown tool";

    // Use completedAt if available, otherwise startedAt for stable hashing
    const timestamp = (part.completedAt || part.startedAt)?.toISOString() || "";

    return {
      id: part.id,
      name: part.tool || "unknown",
      state,
      summary,
      input: part.input || {},
      error: part.error,
      timestamp,
      agentName,
    };
  });

  // Sort by timestamp descending (newest first)
  toolCalls.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  // Limit to 50 most recent
  return toolCalls.slice(0, 50);
}
