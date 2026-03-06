import { stat } from "node:fs/promises";
import { queryProjects } from "../storage";
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
  let directory: string | undefined;

  if (preloadedSessions) {
    directory = preloadedSessions.find((session) => session.projectID === projectId)?.directory;
  } else {
    const projects = queryProjects();
    directory = projects.find((p) => p.id === projectId)?.worktree;
  }

  if (!directory) {
    return null;
  }

  if (!(await directoryExists(directory))) {
    return null;
  }

  return directory;
}
