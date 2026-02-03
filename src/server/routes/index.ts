import type { Hono } from "hono";
import { registerHealthRoutes } from "./health";
import { registerSessionRoutes } from "./sessions";
import { registerPartRoutes } from "./parts";
import { registerProjectRoutes } from "./projects";
import { registerPlanRoute } from "./plan";
import { registerPollRoute } from "./poll";

export function registerRoutes(app: Hono) {
  registerHealthRoutes(app);
  registerSessionRoutes(app);
  registerPartRoutes(app);
  registerProjectRoutes(app);
  registerPlanRoute(app);
  registerPollRoute(app);
}
