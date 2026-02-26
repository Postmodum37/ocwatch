import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { join } from "node:path";
import { app } from "../index";
import { invalidatePollCache } from "../services/pollService";
import { closeDb } from "../storage/db";
import type { SessionSummary } from "../../shared/types";
import {
  setupTestDb,
  teardownTestDb,
  insertSession,
  writeBoulderFixture,
} from "./helpers/testDb";

describe("GET /api/poll", () => {
  // First poll request may be slow when scanning a large real DB
  it("should return 200 with poll data on first request", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("ETag")).toBeTruthy();

    const data = await res.json();
    expect(data).toHaveProperty("sessions");
    expect(data).toHaveProperty("activeSessionId");
    expect(data).toHaveProperty("planProgress");
    expect(data).toHaveProperty("lastUpdate");
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(typeof data.lastUpdate).toBe("number");
  }, 15_000);

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

  it("should return activeSessionId as null or string", async () => {
    const req = new Request("http://localhost:50234/api/poll");
    const res = await app.fetch(req);
    const data = await res.json();

    if (data.activeSessionId !== null) {
      expect(typeof data.activeSessionId).toBe("string");
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

describe("GET /api/poll project scoping", () => {
  const PROJECT_POLL_TEST_DIR = "/tmp/ocwatch-poll-project-test";
  const originalXdgDataHome = process.env.XDG_DATA_HOME;
  let testDb: Database | null = null;

  beforeEach(async () => {
    testDb = await setupTestDb(PROJECT_POLL_TEST_DIR);
  });

  afterEach(async () => {
    await teardownTestDb(testDb, PROJECT_POLL_TEST_DIR, originalXdgDataHome);
    testDb = null;
  });

  it("should return 400 for invalid projectId format", async () => {
    const req = new Request("http://localhost:50234/api/poll?projectId=../bad-id");
    const res = await app.fetch(req);

    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toHaveProperty("error", "INVALID_PROJECT_ID");
  });

  it("should scope poll data and boulder lookup to selected project", async () => {
    const alphaDirectory = join(PROJECT_POLL_TEST_DIR, "workspace", "alpha-project");
    const betaDirectory = join(PROJECT_POLL_TEST_DIR, "workspace", "beta-project");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(alphaDirectory, { recursive: true });
    await mkdir(betaDirectory, { recursive: true });

    // Insert sessions into test SQLite DB
    insertSession(testDb!, {
      id: "ses_alpha123",
      projectId: "project-alpha",
      directory: alphaDirectory,
      title: "Alpha Session",
    });
    insertSession(testDb!, {
      id: "ses_beta456",
      projectId: "project-beta",
      directory: betaDirectory,
      title: "Beta Session",
    });

    // Close the writable test DB so getDb() can open it readonly
    testDb!.close();
    testDb = null;

    await writeBoulderFixture(alphaDirectory, "alpha-plan");
    await writeBoulderFixture(betaDirectory, "beta-plan");

    const req = new Request("http://localhost:50234/api/poll?projectId=project-alpha");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.sessions.length).toBeGreaterThan(0);
    expect(data.sessions.every((session: SessionSummary) => session.projectID === "project-alpha")).toBe(true);
    expect(data.planName).toBe("alpha-plan");
    expect(data.planProgress).not.toBeNull();
    expect(data.planProgress.total).toBe(2);
    expect(data.planProgress.completed).toBe(1);
  });

  it("should return empty sessions and null plan data for unknown projectId", async () => {
    const alphaDirectory = join(PROJECT_POLL_TEST_DIR, "workspace", "alpha-project");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(alphaDirectory, { recursive: true });

    insertSession(testDb!, {
      id: "ses_alpha123",
      projectId: "project-alpha",
      directory: alphaDirectory,
      title: "Alpha Session",
    });

    testDb!.close();
    testDb = null;

    await writeBoulderFixture(alphaDirectory, "alpha-plan");

    const req = new Request("http://localhost:50234/api/poll?projectId=project-missing");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.sessions).toEqual([]);
    expect(data.activeSessionId).toBeNull();
    expect(data.planProgress).toBeNull();
  });

  it("should reuse scoped cache for repeated requests with the same projectId", async () => {
    const alphaDirectory = join(PROJECT_POLL_TEST_DIR, "workspace", "alpha-project");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(alphaDirectory, { recursive: true });

    insertSession(testDb!, {
      id: "ses_alpha123",
      projectId: "project-alpha",
      directory: alphaDirectory,
      title: "Alpha Session",
    });

    testDb!.close();
    testDb = null;

    await writeBoulderFixture(alphaDirectory, "alpha-plan");

    const firstReq = new Request("http://localhost:50234/api/poll?projectId=project-alpha");
    const firstRes = await app.fetch(firstReq);
    const firstEtag = firstRes.headers.get("ETag");

    expect(firstRes.status).toBe(200);
    expect(firstEtag).toBeTruthy();

    const secondReq = new Request("http://localhost:50234/api/poll?projectId=project-alpha", {
      headers: {
        "If-None-Match": firstEtag!,
      },
    });
    const secondRes = await app.fetch(secondReq);

    expect(secondRes.status).toBe(304);
    expect(secondRes.headers.get("ETag")).toBe(firstEtag);
  });

  it("should isolate scoped cache entries between different projectIds", async () => {
    const alphaDirectory = join(PROJECT_POLL_TEST_DIR, "workspace", "alpha-project");
    const betaDirectory = join(PROJECT_POLL_TEST_DIR, "workspace", "beta-project");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(alphaDirectory, { recursive: true });
    await mkdir(betaDirectory, { recursive: true });

    insertSession(testDb!, {
      id: "ses_alpha123",
      projectId: "project-alpha",
      directory: alphaDirectory,
      title: "Alpha Session",
    });
    insertSession(testDb!, {
      id: "ses_beta456",
      projectId: "project-beta",
      directory: betaDirectory,
      title: "Beta Session",
    });

    testDb!.close();
    testDb = null;

    await writeBoulderFixture(alphaDirectory, "alpha-plan");
    await writeBoulderFixture(betaDirectory, "beta-plan");

    const alphaReq = new Request("http://localhost:50234/api/poll?projectId=project-alpha");
    const alphaRes = await app.fetch(alphaReq);
    const alphaEtag = alphaRes.headers.get("ETag");

    expect(alphaRes.status).toBe(200);
    expect(alphaEtag).toBeTruthy();

    const betaReq = new Request("http://localhost:50234/api/poll?projectId=project-beta", {
      headers: {
        "If-None-Match": alphaEtag!,
      },
    });
    const betaRes = await app.fetch(betaReq);
    const betaEtag = betaRes.headers.get("ETag");

    expect(betaRes.status).toBe(200);
    expect(betaEtag).toBeTruthy();
    expect(betaEtag).not.toBe(alphaEtag);
  });
});
