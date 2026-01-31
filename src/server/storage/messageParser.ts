/**
 * Message Parser - Parse OpenCode message JSON files
 * Reads from ~/.local/share/opencode/storage/message/{messageID}.json
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MessageMeta } from "../../shared/types";
import { getStoragePath } from "./sessionParser";

/**
 * Internal JSON structure from OpenCode storage
 */
interface MessageJSON {
  id: string;
  sessionID: string;
  role: string;
  time: {
    created: number;
    completed?: number;
  };
  parentID?: string;
  modelID?: string;
  providerID?: string;
  mode?: string;
  agent?: string;
  path?: {
    cwd: string;
    root: string;
  };
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    reasoning?: number;
    cache?: {
      read: number;
      write: number;
    };
  };
  finish?: string;
}

/**
 * Parse a single message JSON file
 * @param filePath - Absolute path to message JSON file
 * @returns MessageMeta or null if file doesn't exist or is invalid
 */
export async function parseMessage(
  filePath: string
): Promise<MessageMeta | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const json: MessageJSON = JSON.parse(content);

    const totalTokens = json.tokens
      ? json.tokens.input + json.tokens.output
      : undefined;

    return {
      id: json.id,
      sessionID: json.sessionID,
      role: json.role,
      agent: json.agent,
      mode: json.mode,
      modelID: json.modelID,
      providerID: json.providerID,
      parentID: json.parentID,
      tokens: totalTokens,
      createdAt: new Date(json.time.created),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn(`Corrupted JSON file: ${filePath}`);
    }
    return null;
  }
}

/**
 * Get a specific message by messageID
 * @param messageID - Message ID
 * @param storagePath - Optional custom storage path (defaults to XDG path)
 * @returns MessageMeta or null if not found
 */
export async function getMessage(
  messageID: string,
  storagePath?: string
): Promise<MessageMeta | null> {
  const basePath = storagePath || getStoragePath();
  const filePath = join(
    basePath,
    "opencode",
    "storage",
    "message",
    `${messageID}.json`
  );

  return parseMessage(filePath);
}

/**
 * List all messages for a given session
 * @param sessionID - Session ID to filter by
 * @param storagePath - Optional custom storage path (defaults to XDG path)
 * @returns Array of MessageMeta (empty array if directory doesn't exist)
 */
export async function listMessages(
  sessionID: string,
  storagePath?: string
): Promise<MessageMeta[]> {
  const basePath = storagePath || getStoragePath();
  const messageDir = join(basePath, "opencode", "storage", "message");

  try {
    const entries = await readdir(messageDir);
    const messages: MessageMeta[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue;
      }

      const messageID = entry.slice(0, -5);
      const message = await getMessage(messageID, storagePath);

      if (message && message.sessionID === sessionID) {
        messages.push(message);
      }
    }

    return messages;
  } catch (error) {
    return [];
  }
}
