import { describe, it, expect, afterEach } from 'bun:test';
import { checkDbExists, getDb, closeDb } from '../server/storage/db';

// Whether the real DB is present on this machine.
// Evaluated once at module load — before any tests mutate process.env.
const DB_AVAILABLE = checkDbExists();

// ---------------------------------------------------------------------------
// checkDbExists
// ---------------------------------------------------------------------------

describe('checkDbExists', () => {
  it('returns false when XDG_DATA_HOME points to a nonexistent path', () => {
    const original = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = `/tmp/ocwatch-test-nonexistent-${Date.now()}`;

    const result = checkDbExists();

    // Restore env before asserting so failures don't leave stale state
    if (original !== undefined) {
      process.env.XDG_DATA_HOME = original;
    } else {
      delete process.env.XDG_DATA_HOME;
    }

    expect(result).toBe(false);
  });

  it('returns a boolean', () => {
    expect(typeof checkDbExists()).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// getDb
// ---------------------------------------------------------------------------

describe('getDb', () => {
  afterEach(() => {
    // closeDb() resets the singleton only when it holds a live Database.
    // When it's null (no DB found), this is a no-op — intentionally.
    closeDb();
  });

  // This test only runs when the real DB is NOT present (typical CI).
  (DB_AVAILABLE ? it.skip : it)('returns null when DB does not exist', () => {
    const db = getDb();
    expect(db).toBeNull();
  });

  // This test only runs when the real DB IS present (local dev).
  (DB_AVAILABLE ? it : it.skip)('returns a Database instance when DB is available', () => {
    const db = getDb();
    expect(db).not.toBeNull();
    // Verify it's a usable Database by checking it has a query method
    expect(typeof db!.query).toBe('function');
  });

  // Calling getDb() multiple times returns the same cached instance.
  (DB_AVAILABLE ? it : it.skip)('returns the same cached instance on repeated calls', () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });
});
