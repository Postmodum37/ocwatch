import type { Hono } from "hono";
import { parseBoulder, calculatePlanProgress } from "../storage/boulderParser";

export function registerPlanRoute(app: Hono) {
  app.get("/api/plan", async (c) => {
    const boulder = await parseBoulder(process.cwd());
    
    if (!boulder || !boulder.activePlan) {
      return c.json(null);
    }
    
    const planProgress = await calculatePlanProgress(boulder.activePlan);
    return c.json(planProgress);
  });
}
