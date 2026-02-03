import type { Hono } from "hono";
import { ZodError } from "zod";
import { listAllSessions, checkStorageExists } from "../storage/sessionParser";
import { listMessages } from "../storage/messageParser";
import { isAssistantFinished, buildAgentHierarchy, buildSessionTree } from "../services/sessionService";
import { getSessionStatus } from "../utils/sessionStatus";
import { sessionIdSchema, validateParam } from "../validation";

export function registerSessionRoutes(app: Hono) {
  app.get("/api/sessions", async (c) => {
    const storageExists = await checkStorageExists();
    if (!storageExists) {
      return c.json({ 
        error: "OpenCode storage not found",
        message: "OpenCode storage directory does not exist. Please ensure OpenCode is installed.",
        sessions: []
      }, 200);
    }

    const allSessions = await listAllSessions();

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    const recentSessions = allSessions.filter(
      (s) => s.updatedAt.getTime() >= twentyFourHoursAgo
    );

    const sortedSessions = recentSessions.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    const limitedSessions = sortedSessions.slice(0, 20);
    const rootSessions = limitedSessions.filter(s => !s.parentID);

    const sessionsWithActivity = await Promise.all(
      rootSessions.map(async (session) => {
        const messages = await listMessages(session.id);
        const lastAssistantFinished = isAssistantFinished(messages);
        const status = getSessionStatus(messages, false, undefined, undefined, lastAssistantFinished);

        return {
          id: session.id,
          title: session.title,
          projectID: session.projectID,
          parentID: session.parentID,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          status,
          isActive: status === "working" || status === "idle",
        };
      })
    );

    return c.json(sessionsWithActivity);
  });

  app.get("/api/sessions/:id", async (c) => {
    let sessionID: string;
    try {
      sessionID = validateParam(sessionIdSchema, c.req.param("id"));
    } catch (e) {
      if (e instanceof ZodError) {
        return c.json({ error: "VALIDATION_ERROR", message: e.message }, 400);
      }
      throw e;
    }

    const allSessions = await listAllSessions();
    const session = allSessions.find((s) => s.id === sessionID);

    if (!session) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found` }, 404);
    }

    const messages = await listMessages(sessionID);
    const agentHierarchy = buildAgentHierarchy(messages);

    return c.json({
      ...session,
      agentHierarchy,
    });
  });

  app.get("/api/sessions/:id/messages", async (c) => {
    let sessionID: string;
    try {
      sessionID = validateParam(sessionIdSchema, c.req.param("id"));
    } catch (e) {
      if (e instanceof ZodError) {
        return c.json({ error: "VALIDATION_ERROR", message: e.message }, 400);
      }
      throw e;
    }

    const allSessions = await listAllSessions();
    const session = allSessions.find((s) => s.id === sessionID);

    if (!session) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found` }, 404);
    }

    const messages = await listMessages(sessionID);

    const sortedMessages = messages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const limitedMessages = sortedMessages.slice(0, 100);

    return c.json(limitedMessages);
  });

  app.get("/api/sessions/:id/tree", async (c) => {
    let sessionID: string;
    try {
      sessionID = validateParam(sessionIdSchema, c.req.param("id"));
    } catch (e) {
      if (e instanceof ZodError) {
        return c.json({ error: "VALIDATION_ERROR", message: e.message }, 400);
      }
      throw e;
    }

    const allSessions = await listAllSessions();
    const session = allSessions.find((s) => s.id === sessionID);

    if (!session) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found` }, 404);
    }

    const tree = await buildSessionTree(sessionID, allSessions);

    return c.json(tree);
  });
}
