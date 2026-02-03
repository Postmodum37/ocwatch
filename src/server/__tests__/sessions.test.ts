import { describe, test, expect } from "bun:test";
import { app } from "../index";

describe("Session API Endpoints", () => {
  describe("GET /api/sessions", () => {
    test("returns array of sessions", async () => {
      const res = await app.request("/api/sessions");
      expect(res.status).toBe(200);

      const data = (await res.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });

    test("sessions have required fields", async () => {
      const res = await app.request("/api/sessions");
      const data = (await res.json()) as any[];

      if (data.length > 0) {
        const session = data[0];
        expect(session).toHaveProperty("id");
        expect(session).toHaveProperty("title");
        expect(session).toHaveProperty("projectID");
        expect(session).toHaveProperty("createdAt");
        expect(session).toHaveProperty("updatedAt");
        expect(session).toHaveProperty("isActive");
      }
    });

    test("sessions are sorted by updatedAt descending", async () => {
      const res = await app.request("/api/sessions");
      const data = (await res.json()) as any[];

      if (data.length > 1) {
        for (let i = 0; i < data.length - 1; i++) {
          const current = new Date(data[i].updatedAt).getTime();
          const next = new Date(data[i + 1].updatedAt).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    test("returns max 20 sessions", async () => {
      const res = await app.request("/api/sessions");
      const data = (await res.json()) as any[];

      expect(data.length).toBeLessThanOrEqual(20);
    });
  });

  describe("GET /api/sessions/:id", () => {
    test("returns 400 for invalid session ID format", async () => {
      const res = await app.request("/api/sessions/invalid-format");
      expect(res.status).toBe(400);

      const data = (await res.json()) as any;
      expect(data).toHaveProperty("error");
      expect(data.error).toBe("VALIDATION_ERROR");
    });

    test("returns 404 for non-existent session", async () => {
      const res = await app.request("/api/sessions/ses_nonexistent123");
      expect(res.status).toBe(404);

      const data = (await res.json()) as any;
      expect(data).toHaveProperty("error");
    });

    test("returns session details with agent hierarchy", async () => {
      const sessionsRes = await app.request("/api/sessions");
      const sessions = (await sessionsRes.json()) as any[];

      if (sessions.length > 0) {
        const sessionID = sessions[0].id;
        const res = await app.request(`/api/sessions/${sessionID}`);
        expect(res.status).toBe(200);

        const data = (await res.json()) as any;
        expect(data).toHaveProperty("id");
        expect(data).toHaveProperty("title");
        expect(data).toHaveProperty("agentHierarchy");
        expect(typeof data.agentHierarchy).toBe("object");
      }
    });
  });

  describe("GET /api/sessions/:id/messages", () => {
    test("returns 404 for non-existent session", async () => {
      const res = await app.request("/api/sessions/ses_nonexistent123/messages");
      expect(res.status).toBe(404);

      const data = (await res.json()) as any;
      expect(data).toHaveProperty("error");
    });

    test("returns array of messages", async () => {
      const sessionsRes = await app.request("/api/sessions");
      const sessions = (await sessionsRes.json()) as any[];

      if (sessions.length > 0) {
        const sessionID = sessions[0].id;
        const res = await app.request(`/api/sessions/${sessionID}/messages`);
        expect(res.status).toBe(200);

        const data = (await res.json()) as any[];
        expect(Array.isArray(data)).toBe(true);
      }
    });

    test("messages have required fields", async () => {
      const sessionsRes = await app.request("/api/sessions");
      const sessions = (await sessionsRes.json()) as any[];

      if (sessions.length > 0) {
        const sessionID = sessions[0].id;
        const res = await app.request(`/api/sessions/${sessionID}/messages`);
        const data = (await res.json()) as any[];

        if (data.length > 0) {
          const message = data[0];
          expect(message).toHaveProperty("id");
          expect(message).toHaveProperty("sessionID");
          expect(message).toHaveProperty("role");
          expect(message).toHaveProperty("createdAt");
        }
      }
    });

    test("returns max 100 messages", async () => {
      const sessionsRes = await app.request("/api/sessions");
      const sessions = (await sessionsRes.json()) as any[];

      if (sessions.length > 0) {
        const sessionID = sessions[0].id;
        const res = await app.request(`/api/sessions/${sessionID}/messages`);
        const data = (await res.json()) as any[];

        expect(data.length).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("GET /api/sessions/:id/tree", () => {
    test("returns 404 for non-existent session", async () => {
      const res = await app.request("/api/sessions/ses_nonexistent123/tree");
      expect(res.status).toBe(404);

      const data = (await res.json()) as any;
      expect(data).toHaveProperty("error");
    });

    test("returns tree with nodes and edges", async () => {
      const sessionsRes = await app.request("/api/sessions");
      const sessions = (await sessionsRes.json()) as any[];

      if (sessions.length > 0) {
        const sessionID = sessions[0].id;
        const res = await app.request(`/api/sessions/${sessionID}/tree`);
        expect(res.status).toBe(200);

        const data = (await res.json()) as any;
        expect(data).toHaveProperty("nodes");
        expect(data).toHaveProperty("edges");
        expect(Array.isArray(data.nodes)).toBe(true);
        expect(Array.isArray(data.edges)).toBe(true);
      }
    });

    test("tree nodes have required structure", async () => {
      const sessionsRes = await app.request("/api/sessions");
      const sessions = (await sessionsRes.json()) as any[];

      if (sessions.length > 0) {
        const sessionID = sessions[0].id;
        const res = await app.request(`/api/sessions/${sessionID}/tree`);
        const data = (await res.json()) as any;

        if (data.nodes.length > 0) {
          const node = data.nodes[0];
          expect(node).toHaveProperty("id");
          expect(node).toHaveProperty("data");
          expect(node.data).toHaveProperty("title");
          expect(node.data).toHaveProperty("isActive");
        }
      }
    });

    test("tree edges have source and target", async () => {
      const sessionsRes = await app.request("/api/sessions");
      const sessions = (await sessionsRes.json()) as any[];

      if (sessions.length > 0) {
        const sessionID = sessions[0].id;
        const res = await app.request(`/api/sessions/${sessionID}/tree`);
        const data = (await res.json()) as any;

        if (data.edges.length > 0) {
          const edge = data.edges[0];
          expect(edge).toHaveProperty("source");
          expect(edge).toHaveProperty("target");
        }
      }
    });
  });

  describe("GET /api/projects", () => {
    test("returns array of projects", async () => {
      const res = await app.request("/api/projects");
      expect(res.status).toBe(200);

      const data = (await res.json()) as any[];
      expect(Array.isArray(data)).toBe(true);
    });

    test("projects have required fields", async () => {
      const res = await app.request("/api/projects");
      const data = (await res.json()) as any[];

      if (data.length > 0) {
        const project = data[0];
        expect(project).toHaveProperty("id");
        expect(project).toHaveProperty("directory");
        expect(project).toHaveProperty("sessionCount");
        expect(project).toHaveProperty("lastActivityAt");
      }
    });

    test("projects are sorted by most recent activity", async () => {
      const res = await app.request("/api/projects");
      const data = (await res.json()) as any[];

      if (data.length >= 2) {
        const firstActivity = new Date(data[0].lastActivityAt).getTime();
        const secondActivity = new Date(data[1].lastActivityAt).getTime();
        expect(firstActivity).toBeGreaterThanOrEqual(secondActivity);
      }
    });
  });

  describe("GET /api/health", () => {
    test("returns ok status", async () => {
      const res = await app.request("/api/health");
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual({ status: "ok" });
    });
  });
});
