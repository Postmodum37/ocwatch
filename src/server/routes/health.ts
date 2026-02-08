import type { Hono } from "hono";

interface RegisterHealthRoutesOptions {
  defaultProjectId?: string;
  defaultProjectIdPromise?: Promise<string | undefined>;
}

export function registerHealthRoutes(app: Hono, options?: RegisterHealthRoutesOptions) {
  app.get("/api/health", async (c) => {
    const defaultProjectId =
      options?.defaultProjectId ?? (await options?.defaultProjectIdPromise);

    if (defaultProjectId) {
      return c.json({ status: "ok", defaultProjectId });
    }

    return c.json({ status: "ok" });
  });
}
