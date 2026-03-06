import { describe, it, expect } from 'bun:test';
import { checkDbExists } from '../server/storage/db';
import {
  queryProjects,
  querySessions,
  querySession,
  querySessionChildren,
  queryMessages,
  queryParts,
  queryPart,
  queryTodos,
  queryMaxTimestamp,
  listProjects,
  queryProjectByWorktree,
  queryProjectSummaries,
} from '../server/storage/queries';

// Evaluated once at module load — determines which test branches run.
const DB_AVAILABLE = checkDbExists();

// ---------------------------------------------------------------------------
// Graceful no-DB defaults (always run — these cover CI without a DB file)
// ---------------------------------------------------------------------------

describe('queries without DB', () => {
  // Skip this entire describe when DB IS available (because getDb() would
  // succeed and queries would return real data, not the default empty values).
  const guard = (fn: () => void) => {
    if (DB_AVAILABLE) return; // DB present — skip graceful-fallback checks
    fn();
  };

  it('queryMaxTimestamp returns 0 when DB unavailable', () => {
    guard(() => {
      const result = queryMaxTimestamp();
      expect(result).toBe(0);
    });
    // When DB is available, just verify it returns a number
    if (DB_AVAILABLE) {
      expect(typeof queryMaxTimestamp()).toBe('number');
    }
  });

  it('querySessions returns empty array when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = querySessions();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    }
  });

  it('querySession returns null for any ID when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = querySession('nonexistent-id');
      expect(result).toBeNull();
    }
  });

  it('querySessionChildren returns empty array when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = querySessionChildren('nonexistent-id');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    }
  });

  it('queryMessages returns empty array when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = queryMessages('nonexistent-id');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    }
  });

  it('queryParts returns empty array when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = queryParts('nonexistent-id');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    }
  });

  it('queryPart returns null when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = queryPart('nonexistent-id');
      expect(result).toBeNull();
    }
  });

  it('queryTodos returns empty array when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = queryTodos('nonexistent-id');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    }
  });

  it('queryProjects returns empty array when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = queryProjects();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    }
  });

  it('listProjects returns empty array when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = listProjects();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    }
  });

  it('queryProjectByWorktree returns null when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = queryProjectByWorktree('/nonexistent/path');
      expect(result).toBeNull();
    }
  });

  it('queryProjectSummaries returns empty array when DB unavailable', () => {
    if (!DB_AVAILABLE) {
      const result = queryProjectSummaries();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Live DB queries (only run when DB is present)
// ---------------------------------------------------------------------------

describe('queries with real DB', () => {
  (DB_AVAILABLE ? it : it.skip)('queryProjects returns array of project rows', () => {
    const projects = queryProjects();
    expect(Array.isArray(projects)).toBe(true);
    if (projects.length > 0) {
      const first = projects[0];
      expect(typeof first.id).toBe('string');
      expect(typeof first.worktree).toBe('string');
      expect(typeof first.timeCreated).toBe('number');
      expect(typeof first.timeUpdated).toBe('number');
    }
  });

  (DB_AVAILABLE ? it : it.skip)('querySessions returns array of session rows', () => {
    const sessions = querySessions();
    expect(Array.isArray(sessions)).toBe(true);
    if (sessions.length > 0) {
      const first = sessions[0];
      expect(typeof first.id).toBe('string');
      expect(typeof first.projectID).toBe('string');
      expect(typeof first.title).toBe('string');
      expect(typeof first.timeCreated).toBe('number');
      expect(typeof first.timeUpdated).toBe('number');
    }
  });

  (DB_AVAILABLE ? it : it.skip)('querySessions respects limit parameter', () => {
    const sessions = querySessions(undefined, undefined, 1);
    expect(sessions.length).toBeLessThanOrEqual(1);
  });

  (DB_AVAILABLE ? it : it.skip)('queryMaxTimestamp returns a non-negative number', () => {
    const ts = queryMaxTimestamp();
    expect(typeof ts).toBe('number');
    expect(ts).toBeGreaterThanOrEqual(0);
  });

  (DB_AVAILABLE ? it : it.skip)('listProjects returns array of project ID strings', () => {
    const projects = listProjects();
    expect(Array.isArray(projects)).toBe(true);
    for (const p of projects) {
      expect(typeof p).toBe('string');
    }
  });

  (DB_AVAILABLE ? it : it.skip)('queryProjectByWorktree returns null for nonexistent path', () => {
    const result = queryProjectByWorktree('/definitely/does/not/exist');
    expect(result).toBeNull();
  });

  (DB_AVAILABLE ? it : it.skip)('queryProjectByWorktree returns project for known worktree', () => {
    const projects = queryProjects();
    if (projects.length > 0) {
      const knownWorktree = projects[0].worktree;
      const result = queryProjectByWorktree(knownWorktree);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(projects[0].id);
      expect(result!.worktree).toBe(knownWorktree);
    }
  });

  (DB_AVAILABLE ? it : it.skip)('queryProjectSummaries returns array with expected shape', () => {
    const summaries = queryProjectSummaries();
    expect(Array.isArray(summaries)).toBe(true);
    if (summaries.length > 0) {
      const first = summaries[0];
      expect(typeof first.id).toBe('string');
      expect(typeof first.worktree).toBe('string');
      expect(typeof first.sessionCount).toBe('number');
      expect(typeof first.lastActivityAt).toBe('number');
      expect(first.sessionCount).toBeGreaterThanOrEqual(0);
    }
  });

  (DB_AVAILABLE ? it : it.skip)('queryProjectSummaries is sorted by lastActivityAt desc', () => {
    const summaries = queryProjectSummaries();
    for (let i = 1; i < summaries.length; i++) {
      expect(summaries[i - 1].lastActivityAt).toBeGreaterThanOrEqual(summaries[i].lastActivityAt);
    }
  });

  (DB_AVAILABLE ? it : it.skip)('querySession returns null for a nonexistent session ID', () => {
    const result = querySession('ses_definitely_does_not_exist_xyz');
    expect(result).toBeNull();
  });

  (DB_AVAILABLE ? it : it.skip)('querySessionChildren returns empty for nonexistent parent', () => {
    const result = querySessionChildren('ses_definitely_does_not_exist_xyz');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  (DB_AVAILABLE ? it : it.skip)('queryPart returns null for nonexistent part ID', () => {
    const result = queryPart('part_definitely_does_not_exist_xyz');
    expect(result).toBeNull();
  });
});
