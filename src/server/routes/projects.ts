import type { Hono } from "hono";
import { queryProjectSummaries } from "../storage";

export function registerProjectRoutes(app: Hono) {
  app.get("/api/projects", (c) => {
    const summaries = queryProjectSummaries();

    const projects = summaries.map((row) => ({
      id: row.id,
      directory: row.worktree,
      sessionCount: row.sessionCount,
      lastActivityAt: new Date(row.lastActivityAt),
    }));

    return c.json(projects);
  });
}
