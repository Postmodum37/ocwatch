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
  parentID?: string;
  time: {
    created: number; // Unix timestamp in milliseconds
    updated: number;
  };
}

export function getStoragePath(): string {
  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) {
    return xdgDataHome;
  }

  const home = homedir();
  return join(home, ".local", "share");
}

export async function checkStorageExists(): Promise<boolean> {
  try {
    const basePath = getStoragePath();
    const storagePath = join(basePath, "opencode", "storage");
    await readdir(storagePath);
    return true;
  } catch {
    return false;
  }
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
      parentID: json.parentID,
      createdAt: new Date(json.time.created),
      updatedAt: new Date(json.time.updated),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn(`Corrupted JSON file: ${filePath}`);
    }
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
    const results = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => getSession(projectID, entry.slice(0, -5), storagePath))
    );

    return results.filter(
      (session): session is SessionMetadata => session !== null
    );
  } catch (error) {
    // Graceful handling: return empty array if directory doesn't exist
    return [];
  }
}

/**
 * List all project IDs from the session storage
 * @param storagePath - Optional custom storage path (defaults to XDG path)
 * @returns Array of project IDs (empty array if directory doesn't exist)
 */
export async function listProjects(
  storagePath?: string
): Promise<string[]> {
  const basePath = storagePath || getStoragePath();
  const sessionBaseDir = join(basePath, "opencode", "storage", "session");

  try {
    const entries = await readdir(sessionBaseDir, { withFileTypes: true });
    const projectIDs: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        projectIDs.push(entry.name);
      }
    }

    return projectIDs;
  } catch (error) {
    return [];
  }
}

/**
 * List all sessions across all projects
 * @param storagePath - Optional custom storage path (defaults to XDG path)
 * @returns Array of SessionMetadata (empty array if directory doesn't exist)
 */
export async function listAllSessions(
  storagePath?: string
): Promise<SessionMetadata[]> {
  const projectIDs = await listProjects(storagePath);
  const allResults = await Promise.all(
    projectIDs.map((projectID) => listSessions(projectID, storagePath))
  );

  return allResults.flat();
}
