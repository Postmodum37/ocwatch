import type { Database, Statement } from "bun:sqlite";
import { getDb } from "./db";
import type { SessionMetadata } from "../../shared/types";

export interface DbProjectRow {
  id: string;
  name: string | null;
  worktree: string;
  vcs: string | null;
  commands: string | null;
  sandboxes: string | null;
  timeCreated: number;
  timeUpdated: number;
}

export interface DbSessionRow {
  id: string;
  projectID: string;
  parentID: string | null;
  slug: string | null;
  directory: string;
  title: string;
  version: string | null;
  timeCreated: number;
  timeUpdated: number;
}

export interface DbMessageRow {
  id: string;
  sessionID: string;
  timeCreated: number;
  timeUpdated: number;
  role: string | null;
  agent: string | null;
  data: string;
}

export interface DbPartRow {
  id: string;
  messageID: string;
  sessionID: string;
  timeCreated: number;
  timeUpdated: number;
  type: string | null;
  tool: string | null;
  state: string | null;
  data: string;
}

export interface DbTodoRow {
  sessionID: string;
  content: string;
  status: string;
  priority: string;
  position: number;
  timeCreated: number;
  timeUpdated: number;
}

let cachedDb: Database | null | undefined;

let queryProjectsStmt: Statement<DbProjectRow, []> | null = null;
let querySessionsStmt: Statement<DbSessionRow, [string | null, number | null, number]> | null = null;
let querySessionStmt: Statement<DbSessionRow, [string]> | null = null;
let querySessionChildrenStmt: Statement<DbSessionRow, [string]> | null = null;
let queryMessagesStmt: Statement<DbMessageRow, [string, number]> | null = null;
let queryPartsStmt: Statement<DbPartRow, [string]> | null = null;
let queryPartStmt: Statement<DbPartRow, [string]> | null = null;
let queryTodosStmt: Statement<DbTodoRow, [string]> | null = null;
let queryMaxTimestampStmt: Statement<{ maxTimestamp: number | null }, []> | null = null;

function getReadyDb(): Database | null {
  const db = getDb();
  if (!db) {
    return null;
  }

  if (cachedDb === db) {
    return db;
  }

  cachedDb = db;
  queryProjectsStmt = db.query<DbProjectRow, []>(`
    SELECT
      id,
      name,
      worktree,
      vcs,
      commands,
      sandboxes,
      time_created AS timeCreated,
      time_updated AS timeUpdated
    FROM project
    ORDER BY time_updated DESC
  `);

  querySessionsStmt = db.query<DbSessionRow, [string | null, number | null, number]>(`
    SELECT
      id,
      project_id AS projectID,
      parent_id AS parentID,
      slug,
      directory,
      title,
      version,
      time_created AS timeCreated,
      time_updated AS timeUpdated
    FROM session
    WHERE (?1 IS NULL OR project_id = ?1)
      AND (?2 IS NULL OR time_updated > ?2)
    ORDER BY time_updated DESC
    LIMIT ?3
  `);

  querySessionStmt = db.query<DbSessionRow, [string]>(`
    SELECT
      id,
      project_id AS projectID,
      parent_id AS parentID,
      slug,
      directory,
      title,
      version,
      time_created AS timeCreated,
      time_updated AS timeUpdated
    FROM session
    WHERE id = ?1
    LIMIT 1
  `);

  querySessionChildrenStmt = db.query<DbSessionRow, [string]>(`
    SELECT
      id,
      project_id AS projectID,
      parent_id AS parentID,
      slug,
      directory,
      title,
      version,
      time_created AS timeCreated,
      time_updated AS timeUpdated
    FROM session
    WHERE parent_id = ?1
    ORDER BY time_created ASC
  `);

  queryMessagesStmt = db.query<DbMessageRow, [string, number]>(`
    SELECT
      id,
      session_id AS sessionID,
      time_created AS timeCreated,
      time_updated AS timeUpdated,
      json_extract(data, '$.role') AS role,
      json_extract(data, '$.agent') AS agent,
      data
    FROM message
    WHERE session_id = ?1
    ORDER BY time_created DESC
    LIMIT ?2
  `);

  queryPartsStmt = db.query<DbPartRow, [string]>(`
    SELECT
      id,
      message_id AS messageID,
      session_id AS sessionID,
      time_created AS timeCreated,
      time_updated AS timeUpdated,
      json_extract(data, '$.type') AS type,
      json_extract(data, '$.tool') AS tool,
      CASE
        WHEN json_type(data, '$.state') = 'text' THEN json_extract(data, '$.state')
        WHEN json_type(data, '$.state.type') = 'text' THEN json_extract(data, '$.state.type')
        ELSE NULL
      END AS state,
      data
    FROM part
    WHERE session_id = ?1
    ORDER BY time_created DESC
  `);

  queryPartStmt = db.query<DbPartRow, [string]>(`
    SELECT
      id,
      message_id AS messageID,
      session_id AS sessionID,
      time_created AS timeCreated,
      time_updated AS timeUpdated,
      json_extract(data, '$.type') AS type,
      json_extract(data, '$.tool') AS tool,
      CASE
        WHEN json_type(data, '$.state') = 'text' THEN json_extract(data, '$.state')
        WHEN json_type(data, '$.state.type') = 'text' THEN json_extract(data, '$.state.type')
        ELSE NULL
      END AS state,
      data
    FROM part
    WHERE id = ?1
    LIMIT 1
  `);

  queryTodosStmt = db.query<DbTodoRow, [string]>(`
    SELECT
      session_id AS sessionID,
      content,
      status,
      priority,
      position,
      time_created AS timeCreated,
      time_updated AS timeUpdated
    FROM todo
    WHERE session_id = ?1
    ORDER BY position ASC, time_created ASC
  `);

  queryMaxTimestampStmt = db.query<{ maxTimestamp: number | null }, []>(`
    SELECT MAX(ts) AS maxTimestamp
    FROM (
      SELECT MAX(time_updated) AS ts FROM session
      UNION ALL
      SELECT MAX(time_updated) AS ts FROM message
      UNION ALL
      SELECT MAX(time_updated) AS ts FROM part
    )
  `);

  return db;
}

export function queryProjects(): DbProjectRow[] {
  const db = getReadyDb();
  if (!db || !queryProjectsStmt) {
    return [];
  }

  return queryProjectsStmt.all();
}

export function querySessions(
  projectId?: string,
  since?: number,
  limit = 20,
): DbSessionRow[] {
  const db = getReadyDb();
  if (!db || !querySessionsStmt) {
    return [];
  }

  return querySessionsStmt.all(projectId ?? null, since ?? null, limit);
}

export function querySession(sessionId: string): DbSessionRow | null {
  const db = getReadyDb();
  if (!db || !querySessionStmt) {
    return null;
  }

  return querySessionStmt.get(sessionId);
}

export function querySessionChildren(sessionId: string): DbSessionRow[] {
  const db = getReadyDb();
  if (!db || !querySessionChildrenStmt) {
    return [];
  }

  return querySessionChildrenStmt.all(sessionId);
}

export function queryMessages(sessionId: string, limit = 100): DbMessageRow[] {
  const db = getReadyDb();
  if (!db || !queryMessagesStmt) {
    return [];
  }

  return queryMessagesStmt.all(sessionId, limit);
}

export function queryParts(sessionId: string): DbPartRow[] {
  const db = getReadyDb();
  if (!db || !queryPartsStmt) {
    return [];
  }

  return queryPartsStmt.all(sessionId);
}

export function queryPart(partId: string): DbPartRow | null {
  const db = getReadyDb();
  if (!db || !queryPartStmt) {
    return null;
  }

  return queryPartStmt.get(partId);
}

export function queryTodos(sessionId: string): DbTodoRow[] {
  const db = getReadyDb();
  if (!db || !queryTodosStmt) {
    return [];
  }

  return queryTodosStmt.all(sessionId);
}

export function queryMaxTimestamp(): number {
  const db = getReadyDb();
  if (!db || !queryMaxTimestampStmt) {
    return 0;
  }

  return Number(queryMaxTimestampStmt.get()?.maxTimestamp ?? 0);
}

// Wrapper functions for backward compatibility with old sessionParser API

function toSessionMetadata(row: DbSessionRow): SessionMetadata {
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

export function listProjects(): string[] {
  const projects = queryProjects();
  return projects.map((p) => p.id);
}

export async function listAllSessions(): Promise<SessionMetadata[]> {
  const sessions = querySessions(undefined, undefined, 10000);
  return sessions.map(toSessionMetadata);
}
