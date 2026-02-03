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

interface PartStateJSON {
  status?: string;
  input?: Record<string, unknown>;
  output?: string;
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
        input = {
          filePath: json.state.input.filePath as string | undefined,
          command: json.state.input.command as string | undefined,
          pattern: json.state.input.pattern as string | undefined,
          url: json.state.input.url as string | undefined,
          query: json.state.input.query as string | undefined,
        };
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
      startedAt,
      completedAt,
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

const MAX_PATH_LENGTH = 40;

function truncatePath(path: string): string {
  if (path.length <= MAX_PATH_LENGTH) {
    return path;
  }
  return "..." + path.slice(-MAX_PATH_LENGTH + 3);
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  read: "Reading",
  write: "Writing",
  edit: "Editing",
  bash: "Running",
  grep: "Searching",
  glob: "Finding",
  task: "Delegating",
  webfetch: "Fetching",
};

function getToolDisplayName(tool: string): string {
  const normalized = tool.replace(/^mcp_/, "").toLowerCase();
  return TOOL_DISPLAY_NAMES[normalized] || tool;
}

export function formatCurrentAction(part: PartMeta): string | null {
  if (!part.tool) {
    return null;
  }

  const toolName = getToolDisplayName(part.tool);

  if (part.input) {
    if (part.input.filePath) {
      return `${toolName} ${truncatePath(part.input.filePath)}`;
    }
    if (part.input.command) {
      const cmd = part.input.command.length > 30 
        ? part.input.command.slice(0, 27) + "..." 
        : part.input.command;
      return `${toolName} ${cmd}`;
    }
    if (part.input.pattern) {
      return `${toolName} for "${part.input.pattern}"`;
    }
    if (part.input.url) {
      return `${toolName} ${truncatePath(part.input.url)}`;
    }
    if (part.input.query) {
       return `${toolName} "${part.input.query}"`;
     }
   }

    // Handle delegate_task (tool name is "task" or "delegate_task")
    if (part.tool === "task" || part.tool === "delegate_task") {
      const input = part.input as { description?: string; subagent_type?: string } | undefined;
      const desc = input?.description;
      const agentType = input?.subagent_type;
      if (desc && agentType) return `${desc} (${agentType})`;
      if (desc) return desc;
      if (agentType) return `Delegating (${agentType})`;
      return "Delegating task";
    }

    // Handle todowrite
    if (part.tool === "todowrite") {
      const input = part.input as { todos?: Array<{ content?: string }> } | undefined;
      const todos = input?.todos;
      if (!todos || todos.length === 0) return "Cleared todos";
      const preview = todos
        .slice(0, 2)
        .map(t => (t.content || "").slice(0, 30))
        .filter(Boolean)
        .join(", ");
      return `Updated ${todos.length} todos: ${preview}${todos.length > 2 ? "..." : ""}`;
    }

    // Handle todoread
    if (part.tool === "todoread") {
      return "Reading todos";
    }

    if (part.title) {
      return part.title;
    }

  return toolName;
}

// All states that indicate a tool is currently executing or waiting to execute
const ACTIVE_TOOL_STATES = ["pending", "running", "in_progress"];

export function isPendingToolCall(part: PartMeta): boolean {
  if (!part.tool || part.type !== "tool") {
    return false;
  }

  if (!part.state) {
    return false;
  }

  return ACTIVE_TOOL_STATES.includes(part.state);
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
  storagePath?: string
): Promise<ToolCallSummary[]> {
  const parts = await getPartsForSession(sessionID, storagePath);

  // Filter for tool type parts only
  const toolParts = parts.filter((part) => part.type === "tool" && part.tool);

  // Map to ToolCallSummary
  const toolCalls: ToolCallSummary[] = toolParts.map((part) => {
    const agentName = messageAgent.get(part.messageID) || "unknown";

    // Map state to ToolCallSummary state
    let state: "pending" | "complete" | "error" = "complete";
    if (part.state) {
      if (ACTIVE_TOOL_STATES.includes(part.state)) {
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
