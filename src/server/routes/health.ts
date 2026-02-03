import type { Hono } from "hono";

export function registerHealthRoutes(app: Hono) {
  app.get("/api/health", (c) => {
    return c.json({ status: "ok" });
  });
}
