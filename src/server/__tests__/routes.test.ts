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

  test("session detail endpoint returns 400 for invalid session ID format", async () => {
    const req = new Request("http://localhost/api/sessions/invalid-format");
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
  });

  test("session detail endpoint returns 404 for non-existent session", async () => {
    const req = new Request("http://localhost/api/sessions/ses_nonexistent123");
    const res = await app.fetch(req);
    expect(res.status).toBe(404);
  });

  test("session messages endpoint returns 404 for non-existent session", async () => {
    const req = new Request("http://localhost/api/sessions/ses_nonexistent123/messages");
    const res = await app.fetch(req);
    expect(res.status).toBe(404);
  });

  test("session tree endpoint returns 404 for non-existent session", async () => {
    const req = new Request("http://localhost/api/sessions/ses_nonexistent123/tree");
    const res = await app.fetch(req);
    expect(res.status).toBe(404);
  });

  test("parts endpoint returns 404 for non-existent part", async () => {
    const req = new Request("http://localhost/api/parts/test-id");
    const res = await app.fetch(req);
    expect(res.status).toBe(404);
  });

  test("plan endpoint returns null when no plan exists", async () => {
    const req = new Request("http://localhost/api/plan");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeNull();
  });

  test("projects endpoint exists and returns array", async () => {
    const req = new Request("http://localhost/api/projects");
    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
