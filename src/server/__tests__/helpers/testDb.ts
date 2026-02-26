/**
 * Test helper for creating SQLite fixture databases.
 *
 * Creates a real SQLite DB at the expected XDG path so that the
 * db.ts singleton picks it up via `XDG_DATA_HOME`.
 *
 * Usage:
 *   1. Call `setupTestDb(testDir)` in beforeEach — sets XDG_DATA_HOME, creates DB, resets singleton
 *   2. Use `insertSession()` / `insertMessage()` etc. to populate fixtures
 *   3. Call `teardownTestDb(originalXdg)` in afterEach — closes DB, resets singleton, restores env
 */
import { Database } from "bun:sqlite";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { closeDb } from "../../storage/db";
import { invalidatePollCache } from "../../services/pollService";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS project (
    id TEXT PRIMARY KEY,
    name TEXT,
    worktree TEXT NOT NULL DEFAULT '',
    vcs TEXT,
    commands TEXT,
    sandboxes TEXT,
    time_created INTEGER NOT NULL DEFAULT 0,
    time_updated INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    parent_id TEXT,
    slug TEXT,
    directory TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    version TEXT,
    time_created INTEGER NOT NULL DEFAULT 0,
    time_updated INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS message (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL DEFAULT 0,
    time_updated INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS part (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL DEFAULT 0,
    time_updated INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS todo (
    session_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    priority TEXT NOT NULL DEFAULT 'medium',
    position INTEGER NOT NULL DEFAULT 0,
    time_created INTEGER NOT NULL DEFAULT 0,
    time_updated INTEGER NOT NULL DEFAULT 0
);
`;

export interface TestSessionFixture {
  id: string;
  projectId: string;
  directory: string;
  title?: string;
  parentId?: string | null;
  timeCreated?: number;
  timeUpdated?: number;
}

export interface TestMessageFixture {
  id: string;
  sessionId: string;
  role?: string;
  agent?: string;
  timeCreated?: number;
  timeUpdated?: number;
}

/**
 * Returns the expected DB file path for a given test directory.
 */
export function getTestDbPath(testDir: string): string {
  return join(testDir, "opencode", "opencode.db");
}

/**
 * Creates a test SQLite database with the full schema at the XDG-expected path.
 * Returns the Database instance (writable) for inserting fixtures.
 */
export async function createTestDatabase(testDir: string): Promise<Database> {
  const dbDir = join(testDir, "opencode");
  await mkdir(dbDir, { recursive: true });

  const dbPath = getTestDbPath(testDir);
  const db = new Database(dbPath);
  db.exec(SCHEMA_SQL);
  return db;
}

/**
 * Full setup: sets XDG_DATA_HOME, resets db singleton, creates test DB.
 * Returns the writable Database instance for inserting fixtures.
 */
export async function setupTestDb(testDir: string): Promise<Database> {
  await rm(testDir, { recursive: true, force: true });
  await mkdir(testDir, { recursive: true });

  // Reset singleton so it picks up the new XDG path
  closeDb();
  process.env.XDG_DATA_HOME = testDir;
  invalidatePollCache();

  return createTestDatabase(testDir);
}

/**
 * Full teardown: closes writable DB, resets singleton, cleans up, restores env.
 */
export async function teardownTestDb(
  testDb: Database | null,
  testDir: string,
  originalXdg: string | undefined,
): Promise<void> {
  if (testDb) {
    try { testDb.close(); } catch { /* already closed */ }
  }

  closeDb();
  invalidatePollCache();

  await rm(testDir, { recursive: true, force: true });

  if (originalXdg === undefined) {
    delete process.env.XDG_DATA_HOME;
  } else {
    process.env.XDG_DATA_HOME = originalXdg;
  }
}

/**
 * Insert a session fixture into the test database.
 */
export function insertSession(db: Database, fixture: TestSessionFixture): void {
  const now = Date.now();
  db.run(
    `INSERT INTO session (id, project_id, parent_id, slug, directory, title, time_created, time_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fixture.id,
      fixture.projectId,
      fixture.parentId ?? null,
      fixture.id,
      fixture.directory,
      fixture.title ?? `Session ${fixture.id}`,
      fixture.timeCreated ?? now,
      fixture.timeUpdated ?? now,
    ],
  );
}

/**
 * Insert a message fixture into the test database.
 */
export function insertMessage(db: Database, fixture: TestMessageFixture): void {
  const now = Date.now();
  const data = JSON.stringify({
    role: fixture.role ?? "assistant",
    agent: fixture.agent ?? null,
  });
  db.run(
    `INSERT INTO message (id, session_id, time_created, time_updated, data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      fixture.id,
      fixture.sessionId,
      fixture.timeCreated ?? now,
      fixture.timeUpdated ?? now,
      data,
    ],
  );
}

/**
 * Write a boulder.json + plan markdown in a project directory.
 * (Boulder is filesystem-based, not in SQLite.)
 */
export async function writeBoulderFixture(
  projectDirectory: string,
  planName: string,
): Promise<void> {
  const sisyphusDir = join(projectDirectory, ".sisyphus");
  const plansDir = join(sisyphusDir, "plans");
  await mkdir(plansDir, { recursive: true });

  await writeFile(
    join(plansDir, `${planName}.md`),
    ["# Test Plan", "", "- [x] Complete fixture setup", "- [ ] Keep testing"].join("\n"),
  );

  await writeFile(
    join(sisyphusDir, "boulder.json"),
    JSON.stringify({
      active_plan: `.sisyphus/plans/${planName}.md`,
      session_ids: [],
      status: "in-progress",
      started_at: new Date().toISOString(),
      plan_name: planName,
    }),
  );
}
