import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const SQLITE_BUSY_TIMEOUT_MS = 5000;
const SQLITE_CACHE_SIZE = -20000;

let dbSingleton: Database | null | undefined;

function getStorageRootPath(): string {
  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) {
    return xdgDataHome;
  }

  return join(homedir(), ".local", "share");
}

function getDbPath(): string {
  return join(getStorageRootPath(), "opencode", "opencode.db");
}

function configureConnectionPragmas(db: Database): void {
  db.query("PRAGMA busy_timeout = 5000;").run();
  db.query("PRAGMA cache_size = -20000;").run();

  try {
    db.query("PRAGMA journal_mode = WAL;").run();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[storage/db] Failed to enforce WAL journal mode: ${reason}`);
  }
}

export function checkDbExists(): boolean {
  return existsSync(getDbPath());
}

export function getDb(): Database | null {
  if (dbSingleton !== undefined) {
    return dbSingleton;
  }

  if (!checkDbExists()) {
    dbSingleton = null;
    return dbSingleton;
  }

  try {
    const db = new Database(getDbPath(), { readonly: true });
    configureConnectionPragmas(db);
    dbSingleton = db;
    return dbSingleton;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[storage/db] Failed to open SQLite database: ${reason}`);
    dbSingleton = null;
    return dbSingleton;
  }
}

export function closeDb(): void {
  if (!dbSingleton) {
    return;
  }

  dbSingleton.close();
  dbSingleton = undefined;
}

