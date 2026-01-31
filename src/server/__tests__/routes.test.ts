import { describe, test, expect } from "bun:test";
import { app } from "../index";

describe("Hono Server Routes", () => {
  test("health endpoint returns ok status", async () => {
    const req = new Request("http://localhost/api/health");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({ status: "ok" });
  });

  test("sessions endpoint exists and returns array", async () => {
    const req = new Request("http://localhost/api/sessions");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("session detail endpoint exists", async () => {
    const req = new Request("http://localhost/api/sessions/test-id");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });

  test("session messages endpoint exists", async () => {
    const req = new Request("http://localhost/api/sessions/test-id/messages");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("session tree endpoint exists", async () => {
    const req = new Request("http://localhost/api/sessions/test-id/tree");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(typeof data).toBe("object");
  });

  test("parts endpoint exists", async () => {
    const req = new Request("http://localhost/api/parts/test-id");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });

  test("plan endpoint exists", async () => {
    const req = new Request("http://localhost/api/plan");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });

  test("projects endpoint exists and returns array", async () => {
    const req = new Request("http://localhost/api/projects");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
