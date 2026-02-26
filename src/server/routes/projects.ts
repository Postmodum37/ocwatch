import type { Hono } from "hono";
import { listProjects, listAllSessions } from "../storage";

export function registerProjectRoutes(app: Hono) {
  app.get("/api/projects", (c) => {
    const projectIDs = listProjects();
    const allSessions = listAllSessions();

    const projectsWithDetails = projectIDs.map((projectID) => {
      const projectSessions = allSessions.filter((s) => s.projectID === projectID);
      const directory = projectSessions[0]?.directory || "";

      const lastActivityAt =
        projectSessions.length > 0
          ? new Date(
              Math.max(...projectSessions.map((s) => s.updatedAt.getTime()))
            )
          : new Date(0);

      return {
        id: projectID,
        directory,
        sessionCount: projectSessions.length,
        lastActivityAt,
      };
    });

    projectsWithDetails.sort(
      (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
    );

    return c.json(projectsWithDetails);
  });
}
