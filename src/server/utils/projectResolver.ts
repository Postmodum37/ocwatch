import { stat } from "node:fs/promises";
import { listAllSessions } from "../storage";
import type { SessionMetadata } from "../../shared/types";

async function directoryExists(directory: string): Promise<boolean> {
  try {
    const stats = await stat(directory);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function resolveProjectDirectory(
  projectId: string,
  preloadedSessions?: SessionMetadata[],
): Promise<string | null> {
  const allSessions = preloadedSessions ?? listAllSessions();
  const directory = allSessions.find((session) => session.projectID === projectId)?.directory;

  if (!directory) {
    return null;
  }

  if (!(await directoryExists(directory))) {
    return null;
  }

  return directory;
}
