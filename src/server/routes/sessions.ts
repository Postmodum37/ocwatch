import type { Hono } from "hono";
import { checkDbExists } from "../storage";
import {
  querySessions,
  querySession,
  queryMessages,
  queryTodos,
} from "../storage/queries";
import type { DbSessionRow } from "../storage/queries";
import { fetchSessionDetail } from "../services/pollService";
import { toMessageMeta } from "../services/parsing";
import { buildSessionTree } from "../services/sessionService";
import { sessionIdSchema, validateWithResponse } from "../validation";
import { MAX_SESSIONS_LIMIT, MAX_MESSAGES_LIMIT, TWENTY_FOUR_HOURS_MS } from "../../shared/constants";
import type { SessionMetadata } from "../../shared/types";

const SESSION_SCAN_LIMIT = 50_000;

function dbRowToSessionBase(row: DbSessionRow) {
  return {
    id: row.id,
    projectID: row.projectID,
    title: row.title,
    parentID: row.parentID ?? undefined,
    updatedAt: new Date(row.timeUpdated),
    createdAt: new Date(row.timeCreated),
  };
}

function dbRowToSessionMeta(row: DbSessionRow): SessionMetadata {
  return {
    id: row.id,
    projectID: row.projectID,
    directory: row.directory,
    title: row.title,
    parentID: row.parentID ?? undefined,
    createdAt: new Date(row.timeCreated),
    updatedAt: new Date(row.timeUpdated),
  };
}

export function registerSessionRoutes(app: Hono) {
  app.get("/api/sessions", (c) => {
    if (!checkDbExists()) {
      return c.json({
        error: "OpenCode storage not found",
        message: "OpenCode storage directory does not exist. Please ensure OpenCode is installed.",
        sessions: [],
      }, 200);
    }

    const now = Date.now();
    const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;

    const sessions = querySessions(undefined, twentyFourHoursAgo, MAX_SESSIONS_LIMIT)
      .filter((row) => !row.parentID)
      .map(dbRowToSessionBase);

    return c.json(sessions);
  });

  app.get("/api/sessions/:id", async (c) => {
    const validation = validateWithResponse(sessionIdSchema, c.req.param("id"), c);
    if (!validation.success) return validation.response;
    const sessionID = validation.value;

    if (!checkDbExists()) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found`, status: 404 }, 404);
    }

    const sessionRow = querySession(sessionID);
    if (!sessionRow) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found`, status: 404 }, 404);
    }

    const detail = await fetchSessionDetail(sessionID);
    return c.json(detail);
  });

  app.get("/api/sessions/:id/messages", (c) => {
    const validation = validateWithResponse(sessionIdSchema, c.req.param("id"), c);
    if (!validation.success) return validation.response;
    const sessionID = validation.value;

    if (!checkDbExists()) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found`, status: 404 }, 404);
    }

    const sessionRow = querySession(sessionID);
    if (!sessionRow) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found`, status: 404 }, 404);
    }

    const messages = queryMessages(sessionID, MAX_MESSAGES_LIMIT).map(toMessageMeta);
    return c.json(messages);
  });

  app.get("/api/sessions/:id/tree", async (c) => {
    const validation = validateWithResponse(sessionIdSchema, c.req.param("id"), c);
    if (!validation.success) return validation.response;
    const sessionID = validation.value;

    if (!checkDbExists()) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found`, status: 404 }, 404);
    }

    const sessionRow = querySession(sessionID);
    if (!sessionRow) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found`, status: 404 }, 404);
    }

    const allSessions = querySessions(undefined, undefined, SESSION_SCAN_LIMIT).map(dbRowToSessionMeta);
    const tree = await buildSessionTree(sessionID, allSessions);
    return c.json(tree);
  });

  app.get("/api/sessions/:id/activity", async (c) => {
    const validation = validateWithResponse(sessionIdSchema, c.req.param("id"), c);
    if (!validation.success) return validation.response;
    const sessionID = validation.value;

    if (!checkDbExists()) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found`, status: 404 }, 404);
    }

    const sessionRow = querySession(sessionID);
    if (!sessionRow) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found`, status: 404 }, 404);
    }

    const detail = await fetchSessionDetail(sessionID);
    return c.json({ activity: detail.activity });
  });

  app.get("/api/sessions/:id/todos", (c) => {
    const validation = validateWithResponse(sessionIdSchema, c.req.param("id"), c);
    if (!validation.success) return validation.response;
    const sessionID = validation.value;

    if (!checkDbExists()) {
      return c.json([], 200);
    }

    const sessionRow = querySession(sessionID);
    if (!sessionRow) {
      return c.json({ error: "SESSION_NOT_FOUND", message: `Session '${sessionID}' not found`, status: 404 }, 404);
    }

    const todos = queryTodos(sessionID).map((row) => ({
      content: row.content,
      status: row.status,
      priority: row.priority,
      position: row.position,
    }));
    return c.json(todos);
  });
}
