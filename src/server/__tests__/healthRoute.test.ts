import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { registerHealthRoutes } from "../routes/health";

describe("registerHealthRoutes", () => {
  test("returns status only when no default project is configured", async () => {
    const app = new Hono();
    registerHealthRoutes(app);

    const res = await app.request("/api/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  test("returns status and default project when configured", async () => {
    const app = new Hono();
    registerHealthRoutes(app, { defaultProjectId: "proj_123" });

    const res = await app.request("/api/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok", defaultProjectId: "proj_123" });
  });

  test("returns status only when default project promise resolves undefined", async () => {
    const app = new Hono();
    registerHealthRoutes(app, { defaultProjectIdPromise: Promise.resolve(undefined) });

    const res = await app.request("/api/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});
