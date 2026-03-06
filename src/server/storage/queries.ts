import type { Database, Statement } from "bun:sqlite";
import { getDb } from "./db";

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

export interface DbProjectSummaryRow {
  id: string;
  worktree: string;
  sessionCount: number;
  lastActivityAt: number;
}

let cachedDb: Database | null | undefined;

let queryProjectsStmt: Statement<DbProjectRow, []> | null = null;
let querySessionsStmt: Statement<DbSessionRow, [string | null, number | null, number]> | null = null;
let querySessionStmt: Statement<DbSessionRow, [string]> | null = null;
let querySessionChildrenStmt: Statement<DbSessionRow, [string]> | null = null;
let querySessionSubtreeStmt: Statement<DbSessionRow, [string]> | null = null;
let queryMessagesStmt: Statement<DbMessageRow, [string, number]> | null = null;
let queryPartsStmt: Statement<DbPartRow, [string]> | null = null;
let queryPartStmt: Statement<DbPartRow, [string]> | null = null;
let queryTodosStmt: Statement<DbTodoRow, [string]> | null = null;
let queryMaxTimestampStmt: Statement<{ maxTimestamp: number | null }, []> | null = null;
let querySessionSubtreeRevisionStmt: Statement<{ maxTimestamp: number | null }, [string]> | null = null;
let queryProjectByWorktreeStmt: Statement<DbProjectRow, [string]> | null = null;
let queryProjectSummariesStmt: Statement<DbProjectSummaryRow, []> | null = null;

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

  querySessionSubtreeStmt = db.query<DbSessionRow, [string]>(`
    WITH RECURSIVE subtree AS (
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

      UNION ALL

      SELECT
        s.id,
        s.project_id AS projectID,
        s.parent_id AS parentID,
        s.slug,
        s.directory,
        s.title,
        s.version,
        s.time_created AS timeCreated,
        s.time_updated AS timeUpdated
      FROM session s
      INNER JOIN subtree st ON s.parent_id = st.id
    )
    SELECT
      id,
      projectID,
      parentID,
      slug,
      directory,
      title,
      version,
      timeCreated,
      timeUpdated
    FROM subtree
    ORDER BY timeCreated ASC, id ASC
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

  querySessionSubtreeRevisionStmt = db.query<{ maxTimestamp: number | null }, [string]>(`
    WITH RECURSIVE subtree AS (
      SELECT id
      FROM session
      WHERE id = ?1

      UNION ALL

      SELECT s.id
      FROM session s
      INNER JOIN subtree st ON s.parent_id = st.id
    )
    SELECT MAX(ts) AS maxTimestamp
    FROM (
      SELECT MAX(time_updated) AS ts FROM session WHERE id IN (SELECT id FROM subtree)
      UNION ALL
      SELECT MAX(time_updated) AS ts FROM message WHERE session_id IN (SELECT id FROM subtree)
      UNION ALL
      SELECT MAX(time_updated) AS ts FROM part WHERE session_id IN (SELECT id FROM subtree)
    )
  `);

  queryProjectByWorktreeStmt = db.query<DbProjectRow, [string]>(`
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
    WHERE worktree = ?1
    LIMIT 1
  `);

  queryProjectSummariesStmt = db.query<DbProjectSummaryRow, []>(`
    SELECT
      p.id,
      p.worktree,
      COUNT(s.id) AS sessionCount,
      COALESCE(MAX(s.time_updated), p.time_updated) AS lastActivityAt
    FROM project p
    LEFT JOIN session s ON s.project_id = p.id
    GROUP BY p.id
    ORDER BY lastActivityAt DESC
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

export function querySessionSubtree(sessionId: string): DbSessionRow[] {
  const db = getReadyDb();
  if (!db || !querySessionSubtreeStmt) {
    return [];
  }

  return querySessionSubtreeStmt.all(sessionId);
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

export function queryMessagesForSessions(sessionIds: string[], limitPerSession = 100): DbMessageRow[] {
  const db = getReadyDb();
  if (!db || sessionIds.length === 0) {
    return [];
  }

  const placeholders = sessionIds.map((_, index) => `?${index + 1}`).join(", ");
  const limitParam = `?${sessionIds.length + 1}`;
  const statement = db.query<DbMessageRow, (string | number)[]>(`
    SELECT
      id,
      sessionID,
      timeCreated,
      timeUpdated,
      role,
      agent,
      data
    FROM (
      SELECT
        id,
        session_id AS sessionID,
        time_created AS timeCreated,
        time_updated AS timeUpdated,
        json_extract(data, '$.role') AS role,
        json_extract(data, '$.agent') AS agent,
        data,
        ROW_NUMBER() OVER (
          PARTITION BY session_id
          ORDER BY time_created DESC, id DESC
        ) AS rowNumber
      FROM message
      WHERE session_id IN (${placeholders})
    )
    WHERE rowNumber <= ${limitParam}
    ORDER BY sessionID ASC, timeCreated DESC, id DESC
  `);

  return statement.all(...sessionIds, limitPerSession);
}

export function queryPartsForSessions(sessionIds: string[]): DbPartRow[] {
  const db = getReadyDb();
  if (!db || sessionIds.length === 0) {
    return [];
  }

  const placeholders = sessionIds.map((_, index) => `?${index + 1}`).join(", ");
  const statement = db.query<DbPartRow, string[]>(`
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
    WHERE session_id IN (${placeholders})
    ORDER BY sessionID ASC, timeCreated DESC, id DESC
  `);

  return statement.all(...sessionIds);
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

export function querySessionSubtreeRevision(sessionId: string): number {
  const db = getReadyDb();
  if (!db || !querySessionSubtreeRevisionStmt) {
    return 0;
  }

  return Number(querySessionSubtreeRevisionStmt.get(sessionId)?.maxTimestamp ?? 0);
}


export function listProjects(): string[] {
  const projects = queryProjects();
  return projects.map((p) => p.id);
}

export function queryProjectByWorktree(directory: string): DbProjectRow | null {
  const db = getReadyDb();
  if (!db || !queryProjectByWorktreeStmt) {
    return null;
  }

  return queryProjectByWorktreeStmt.get(directory);
}

export function queryProjectSummaries(): DbProjectSummaryRow[] {
  const db = getReadyDb();
  if (!db || !queryProjectSummariesStmt) {
    return [];
  }

  return queryProjectSummariesStmt.all();
}
