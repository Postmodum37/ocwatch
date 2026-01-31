/**
 * Session Parser - Parse OpenCode session JSON files
 * Reads from ~/.local/share/opencode/storage/session/{projectID}/{sessionID}.json
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { SessionMetadata } from "../../shared/types";

/**
 * Internal JSON structure from OpenCode storage
 */
interface SessionJSON {
  id: string;
  slug: string;
  version?: string;
  projectID: string;
  directory: string;
  title: string;
  time: {
    created: number; // Unix timestamp in milliseconds
    updated: number;
  };
}

/**
 * Get the OpenCode storage path, respecting XDG_DATA_HOME
 */
export function getStoragePath(): string {
  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) {
    return xdgDataHome;
  }

  const home = homedir();
  return join(home, ".local", "share");
}

/**
 * Parse a single session JSON file
 * @param filePath - Absolute path to session JSON file
 * @returns SessionMetadata or null if file doesn't exist or is invalid
 */
export async function parseSession(
  filePath: string
): Promise<SessionMetadata | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    const json: SessionJSON = JSON.parse(content);

    return {
      id: json.id,
      projectID: json.projectID,
      directory: json.directory,
      title: json.title,
      parentID: undefined, // OpenCode sessions don't have parentID in storage
      createdAt: new Date(json.time.created),
      updatedAt: new Date(json.time.updated),
    };
  } catch (error) {
    // Graceful handling: return null for missing/invalid files
    return null;
  }
}

/**
 * Get a specific session by projectID and sessionID
 * @param projectID - Project hash ID
 * @param sessionID - Session ID
 * @param storagePath - Optional custom storage path (defaults to XDG path)
 * @returns SessionMetadata or null if not found
 */
export async function getSession(
  projectID: string,
  sessionID: string,
  storagePath?: string
): Promise<SessionMetadata | null> {
  const basePath = storagePath || getStoragePath();
  const filePath = join(
    basePath,
    "opencode",
    "storage",
    "session",
    projectID,
    `${sessionID}.json`
  );

  return parseSession(filePath);
}

/**
 * List all sessions for a given project
 * @param projectID - Project hash ID
 * @param storagePath - Optional custom storage path (defaults to XDG path)
 * @returns Array of SessionMetadata (empty array if directory doesn't exist)
 */
export async function listSessions(
  projectID: string,
  storagePath?: string
): Promise<SessionMetadata[]> {
  const basePath = storagePath || getStoragePath();
  const sessionDir = join(
    basePath,
    "opencode",
    "storage",
    "session",
    projectID
  );

  try {
    const entries = await readdir(sessionDir);
    const sessions: SessionMetadata[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".json")) {
        continue;
      }

      const sessionID = entry.slice(0, -5); // Remove .json extension
      const session = await getSession(projectID, sessionID, storagePath);

      if (session) {
        sessions.push(session);
      }
    }

    return sessions;
  } catch (error) {
    // Graceful handling: return empty array if directory doesn't exist
    return [];
  }
}
