/**
 * Part Parser - Parse OpenCode part JSON files (lazy loading)
 * Reads from ~/.local/share/opencode/storage/part/{partID}.json
 * 
 * IMPORTANT: With 25,748+ part files, this parser uses lazy loading.
 * Only load individual part files on demand, never read all at once.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PartMeta } from "../../shared/types";
import { getStoragePath } from "./sessionParser";

interface PartStateJSON {
  status?: string;
  input?: Record<string, unknown>;
  output?: string;
  title?: string;
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

  if (part.title) {
    return part.title;
  }

  return toolName;
}
