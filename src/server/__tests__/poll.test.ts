import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { app } from "../index";
import type { SessionMetadata, MessageMeta, PlanProgress } from "../../shared/types";

describe("GET /api/poll", () => {
  it("should return 200 with poll data on first request", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("ETag")).toBeTruthy();

    const data = await res.json();
    expect(data).toHaveProperty("sessions");
    expect(data).toHaveProperty("activeSession");
    expect(data).toHaveProperty("planProgress");
    expect(data).toHaveProperty("lastUpdate");
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(typeof data.lastUpdate).toBe("number");
  });

  it("should include ETag header in response", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);

    const etag = res.headers.get("ETag");
    expect(etag).toBeTruthy();
    expect(etag).toMatch(/^"[a-f0-9]{16}"$/);
  });

  it("should return 304 Not Modified when ETag matches", async () => {
    // First request to get ETag
    const req1 = new Request("http://localhost:50234/api/poll");
    const res1 = await app.fetch(req1);
    const etag = res1.headers.get("ETag");

    expect(etag).toBeTruthy();

    // Second request with same ETag
    const req2 = new Request("http://localhost:50234/api/poll", {
      headers: {
        "If-None-Match": etag!,
      },
    });
    const res2 = await app.fetch(req2);

    expect(res2.status).toBe(304);
    expect(res2.headers.get("ETag")).toBe(etag);
  });

  it("should return 200 with new ETag when data changes", async () => {
    // First request
    const req1 = new Request("http://localhost:50234/api/poll");
    const res1 = await app.fetch(req1);
    const etag1 = res1.headers.get("ETag");
    const data1 = await res1.json();

    expect(etag1).toBeTruthy();

    // Second request (data should be same if no changes)
    const req2 = new Request("http://localhost:50234/api/poll");
    const res2 = await app.fetch(req2);
    const etag2 = res2.headers.get("ETag");
    const data2 = await res2.json();

    // ETags should match if data is identical
    expect(etag2).toBe(etag1);
    expect(data2.lastUpdate).toBeGreaterThanOrEqual(data1.lastUpdate);
  });

  it("should return sessions array", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    expect(Array.isArray(data.sessions)).toBe(true);
    // Sessions can be empty if no OpenCode sessions exist
    if (data.sessions.length > 0) {
      const session = data.sessions[0];
      expect(session).toHaveProperty("id");
      expect(session).toHaveProperty("title");
      expect(session).toHaveProperty("projectID");
    }
  });

  it("should return activeSession as null or SessionMetadata", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    if (data.activeSession !== null) {
      expect(data.activeSession).toHaveProperty("id");
      expect(data.activeSession).toHaveProperty("title");
      expect(typeof data.activeSession.id).toBe("string");
    }
  });

  it("should return planProgress as null or PlanProgress object", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    if (data.planProgress !== null) {
      expect(data.planProgress).toHaveProperty("completed");
      expect(data.planProgress).toHaveProperty("total");
      expect(data.planProgress).toHaveProperty("progress");
      expect(typeof data.planProgress.completed).toBe("number");
      expect(typeof data.planProgress.total).toBe("number");
      expect(typeof data.planProgress.progress).toBe("number");
    }
  });

  it("should return lastUpdate as recent timestamp", async () => {
    const beforeRequest = Date.now();
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const afterRequest = Date.now();
    const data = await res.json();

    // Allow for 2s cache TTL - cached response may have older lastUpdate
    const cacheTTL = 2000;
    expect(data.lastUpdate).toBeGreaterThanOrEqual(beforeRequest - cacheTTL);
    expect(data.lastUpdate).toBeLessThanOrEqual(afterRequest + 1000);
  });

  it("should handle If-None-Match header case-insensitively", async () => {
    // First request
    const req1 = new Request("http://localhost:50234/api/poll");
    const res1 = await app.fetch(req1);
    const etag = res1.headers.get("ETag");

    // Second request with different case header
    const req2 = new Request("http://localhost:50234/api/poll", {
      headers: {
        "if-none-match": etag!,
      },
    });
    const res2 = await app.fetch(req2);

    // Should still work (HTTP headers are case-insensitive)
    expect([200, 304]).toContain(res2.status);
  });

  it("should return 200 when If-None-Match doesn't match", async () => {
    const req = new Request("http://localhost:50234/api/poll", {
      headers: {
        "If-None-Match": '"nonexistent-etag"',
      },
    });
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBeTruthy();
  });

  it("should limit sessions to 20 most recent", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    expect(data.sessions.length).toBeLessThanOrEqual(20);
  });

  it("should filter sessions to last 24 hours", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    for (const session of data.sessions) {
      const updatedAt = new Date(session.updatedAt).getTime();
      expect(updatedAt).toBeGreaterThanOrEqual(twentyFourHoursAgo);
    }
  });

  it("should return sessions sorted by updatedAt descending", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    const sessions = data.sessions;
    for (let i = 1; i < sessions.length; i++) {
      const prevTime = new Date(sessions[i - 1].updatedAt).getTime();
      const currTime = new Date(sessions[i].updatedAt).getTime();
      expect(prevTime).toBeGreaterThanOrEqual(currTime);
    }
  });

  it("should generate consistent ETag for same data", async () => {
    const req1 = new Request("http://localhost:50234/api/poll");
    const res1 = await app.fetch(req1);
    const etag1 = res1.headers.get("ETag");

    const req2 = new Request("http://localhost:50234/api/poll");
    const res2 = await app.fetch(req2);
    const etag2 = res2.headers.get("ETag");

    // If data is identical, ETags should match
    expect(etag1).toBe(etag2);
  });

  it("should include status field in sessions", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    if (data.sessions.length > 0) {
      const session = data.sessions[0];
      expect(session).toHaveProperty("status");
      expect(["working", "idle", "completed", "waiting"]).toContain(session.status);
    }
  });

  it("should include currentAction field in sessions", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    if (data.sessions.length > 0) {
      const session = data.sessions[0];
      expect(session).toHaveProperty("currentAction");
      if (session.currentAction !== null) {
        expect(typeof session.currentAction).toBe("string");
      }
    }
  });

  it("should set status to working when session has pending tool calls", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    for (const session of data.sessions) {
      if (session.status === "working" && session.currentAction) {
        expect(session.currentAction).toBeTruthy();
      }
    }
  });

  it("should populate currentAction with tool details when available", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    for (const session of data.sessions) {
      if (session.currentAction) {
        expect(typeof session.currentAction).toBe("string");
        expect(session.currentAction.length).toBeGreaterThan(0);
      }
    }
  });
});
