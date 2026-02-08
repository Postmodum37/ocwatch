import type { Hono } from "hono";
import { registerHealthRoutes } from "./health";
import { registerSessionRoutes } from "./sessions";
import { registerPartRoutes } from "./parts";
import { registerProjectRoutes } from "./projects";
import { registerPlanRoute } from "./plan";
import { registerPollRoute } from "./poll";
import { registerSSERoute } from "./sse";

interface RegisterRoutesOptions {
  defaultProjectId?: string;
  defaultProjectIdPromise?: Promise<string | undefined>;
}

export function registerRoutes(app: Hono, options?: RegisterRoutesOptions) {
  registerHealthRoutes(app, {
    defaultProjectId: options?.defaultProjectId,
    defaultProjectIdPromise: options?.defaultProjectIdPromise,
  });
  registerSessionRoutes(app);
  registerPartRoutes(app);
  registerProjectRoutes(app);
  registerPlanRoute(app);
  registerPollRoute(app);
  registerSSERoute(app);
}
