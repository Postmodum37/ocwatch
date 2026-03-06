/**
 * Creates an empty OpenCode SQLite database for CI.
 * Ensures smoke tests that hit endpoints without fixtures
 * get empty results instead of "storage not found" errors.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const xdg = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
const dbDir = join(xdg, "opencode");
mkdirSync(dbDir, { recursive: true });

const dbPath = join(dbDir, "opencode.db");
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS project (
    id TEXT PRIMARY KEY, name TEXT, worktree TEXT NOT NULL DEFAULT '',
    vcs TEXT, commands TEXT, sandboxes TEXT,
    time_created INTEGER NOT NULL DEFAULT 0, time_updated INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_id TEXT, slug TEXT,
    directory TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', version TEXT,
    time_created INTEGER NOT NULL DEFAULT 0, time_updated INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS message (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL DEFAULT 0, time_updated INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS part (
    id TEXT PRIMARY KEY, message_id TEXT NOT NULL, session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL DEFAULT 0, time_updated INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS todo (
    session_id TEXT NOT NULL, content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending', priority TEXT NOT NULL DEFAULT 'medium',
    position INTEGER NOT NULL DEFAULT 0,
    time_created INTEGER NOT NULL DEFAULT 0, time_updated INTEGER NOT NULL DEFAULT 0
  );
`);

db.close();
console.log(`CI test database created at ${dbPath}`);
