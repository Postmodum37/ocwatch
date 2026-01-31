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

/**
 * Internal JSON structure from OpenCode storage
 */
interface PartJSON {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
  callID?: string;
  tool?: string;
  state?: string;
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

    return {
      id: json.id,
      sessionID: json.sessionID,
      messageID: json.messageID,
      type: json.type,
      callID: json.callID,
      tool: json.tool,
      state: json.state,
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
