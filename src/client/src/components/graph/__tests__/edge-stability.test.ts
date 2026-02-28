/**
 * Edge stability tests for GraphView's fingerprint and edge comparison logic.
 *
 * getSessionFingerprint is NOT exported from GraphView.tsx, so the function is
 * replicated here. Tests verify the fingerprint captures the correct fields and
 * the edge topology+direction comparison correctly detects changes.
 */
import { describe, it, expect } from 'vitest';
import type { ActivitySession } from '@shared/types';
import type { EdgeDirection } from '../AnimatedEdge';

// ---------------------------------------------------------------------------
// Replication of getSessionFingerprint from GraphView.tsx (not exported).
// Must stay in sync with the original.
// ---------------------------------------------------------------------------
function getSessionFingerprint(session: Partial<ActivitySession>): string {
  return JSON.stringify({
    status: session.status,
    activityType: session.activityType,
    currentAction: session.currentAction,
    workingChildCount: session.workingChildCount,
    pendingToolCount: session.pendingToolCount,
    patchFilesCount: session.patchFilesCount,
    agent: session.agent,
    modelID: session.modelID,
    providerID: session.providerID,
    tokens: session.tokens,
    updatedAt: session.updatedAt,
    toolCalls: session.toolCalls,
    parentID: session.parentID,
    title: session.title,
  });
}

// ---------------------------------------------------------------------------
// Replication of edge topology + direction stability check from GraphView.tsx.
// ---------------------------------------------------------------------------
type EdgeRecord = { id: string; source: string; target: string; direction: EdgeDirection };
type EdgeItem = { id: string; source: string; target: string };

function edgesAreStable(
  prevEdges: EdgeItem[],
  edgeRecords: EdgeRecord[],
  prevDirections: Map<string, EdgeDirection | null>,
): boolean {
  const topologyUnchanged =
    prevEdges.length === edgeRecords.length &&
    prevEdges.every((edge) => {
      const nextRecord = edgeRecords.find((record) => record.id === edge.id);
      return !!nextRecord && edge.source === nextRecord.source && edge.target === nextRecord.target;
    });

  const nextEdgeDirections = new Map(edgeRecords.map((r) => [r.id, r.direction]));
  const directionsUnchanged =
    topologyUnchanged &&
    prevDirections.size === nextEdgeDirections.size &&
    edgeRecords.every((record) => prevDirections.get(record.id) === nextEdgeDirections.get(record.id));

  return topologyUnchanged && directionsUnchanged;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSession(overrides: Partial<ActivitySession> = {}): ActivitySession {
  return {
    id: 'ses_test1',
    title: 'Test Session',
    agent: 'build',
    modelID: 'claude-sonnet',
    providerID: 'anthropic',
    parentID: undefined,
    tokens: 1000,
    status: 'idle',
    currentAction: null,
    activityType: 'idle',
    pendingToolCount: 0,
    patchFilesCount: 0,
    workingChildCount: 0,
    toolCalls: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: getSessionFingerprint
// ---------------------------------------------------------------------------
describe('getSessionFingerprint', () => {
  it('produces different fingerprints when tokens change', () => {
    const s1 = makeSession({ tokens: 1000 });
    const s2 = makeSession({ tokens: 2000 });

    expect(getSessionFingerprint(s1)).not.toBe(getSessionFingerprint(s2));
  });

  it('produces different fingerprints when updatedAt changes', () => {
    const s1 = makeSession({ updatedAt: new Date('2024-01-01') });
    const s2 = makeSession({ updatedAt: new Date('2024-01-02') });

    expect(getSessionFingerprint(s1)).not.toBe(getSessionFingerprint(s2));
  });

  it('produces different fingerprints when status changes', () => {
    const s1 = makeSession({ status: 'idle' });
    const s2 = makeSession({ status: 'working' });

    expect(getSessionFingerprint(s1)).not.toBe(getSessionFingerprint(s2));
  });

  it('produces different fingerprints when currentAction changes', () => {
    const s1 = makeSession({ currentAction: null });
    const s2 = makeSession({ currentAction: 'Reading file' });

    expect(getSessionFingerprint(s1)).not.toBe(getSessionFingerprint(s2));
  });

  it('produces different fingerprints when activityType changes', () => {
    const s1 = makeSession({ activityType: 'idle' });
    const s2 = makeSession({ activityType: 'tool' });

    expect(getSessionFingerprint(s1)).not.toBe(getSessionFingerprint(s2));
  });

  it('produces different fingerprints when parentID changes', () => {
    const s1 = makeSession({ parentID: undefined });
    const s2 = makeSession({ parentID: 'ses_parent' });

    expect(getSessionFingerprint(s1)).not.toBe(getSessionFingerprint(s2));
  });

  it('produces identical fingerprints when all fingerprinted fields are the same', () => {
    const updatedAt = new Date('2024-01-01');
    const s1 = makeSession({ tokens: 500, updatedAt, status: 'working' });
    const s2 = makeSession({ tokens: 500, updatedAt, status: 'working' });

    expect(getSessionFingerprint(s1)).toBe(getSessionFingerprint(s2));
  });

  it('produces identical fingerprints regardless of id or createdAt (not fingerprinted)', () => {
    // id and createdAt are NOT included in getSessionFingerprint
    const s1 = makeSession({ id: 'ses_A', createdAt: new Date('2024-01-01') });
    const s2 = makeSession({ id: 'ses_B', createdAt: new Date('2024-06-15') });

    expect(getSessionFingerprint(s1)).toBe(getSessionFingerprint(s2));
  });
});

// ---------------------------------------------------------------------------
// Tests: edge topology and direction stability
// ---------------------------------------------------------------------------
describe('edge topology and direction stability', () => {
  it('is stable when topology and directions are unchanged', () => {
    const prevEdges: EdgeItem[] = [{ id: 'A-B', source: 'A', target: 'B' }];
    const edgeRecords: EdgeRecord[] = [{ id: 'A-B', source: 'A', target: 'B', direction: null }];
    const prevDirections = new Map<string, EdgeDirection | null>([['A-B', null]]);

    expect(edgesAreStable(prevEdges, edgeRecords, prevDirections)).toBe(true);
  });

  it('is stable with multiple edges unchanged', () => {
    const prevEdges: EdgeItem[] = [
      { id: 'A-B', source: 'A', target: 'B' },
      { id: 'A-C', source: 'A', target: 'C' },
    ];
    const edgeRecords: EdgeRecord[] = [
      { id: 'A-B', source: 'A', target: 'B', direction: 'down' },
      { id: 'A-C', source: 'A', target: 'C', direction: null },
    ];
    const prevDirections = new Map<string, EdgeDirection | null>([
      ['A-B', 'down'],
      ['A-C', null],
    ]);

    expect(edgesAreStable(prevEdges, edgeRecords, prevDirections)).toBe(true);
  });

  it('detects topology change when a new session (edge) is added', () => {
    const prevEdges: EdgeItem[] = [{ id: 'A-B', source: 'A', target: 'B' }];
    const edgeRecords: EdgeRecord[] = [
      { id: 'A-B', source: 'A', target: 'B', direction: null },
      { id: 'A-C', source: 'A', target: 'C', direction: null },
    ];
    const prevDirections = new Map<string, EdgeDirection | null>([['A-B', null]]);

    expect(edgesAreStable(prevEdges, edgeRecords, prevDirections)).toBe(false);
  });

  it('detects topology change when a session (edge) is removed', () => {
    const prevEdges: EdgeItem[] = [
      { id: 'A-B', source: 'A', target: 'B' },
      { id: 'A-C', source: 'A', target: 'C' },
    ];
    const edgeRecords: EdgeRecord[] = [{ id: 'A-B', source: 'A', target: 'B', direction: null }];
    const prevDirections = new Map<string, EdgeDirection | null>([
      ['A-B', null],
      ['A-C', null],
    ]);

    expect(edgesAreStable(prevEdges, edgeRecords, prevDirections)).toBe(false);
  });

  it('detects direction change from null to down (child starts working)', () => {
    const prevEdges: EdgeItem[] = [{ id: 'A-B', source: 'A', target: 'B' }];
    const edgeRecords: EdgeRecord[] = [{ id: 'A-B', source: 'A', target: 'B', direction: 'down' }];
    const prevDirections = new Map<string, EdgeDirection | null>([['A-B', null]]);

    expect(edgesAreStable(prevEdges, edgeRecords, prevDirections)).toBe(false);
  });

  it('detects direction change from down to up (child completed → reverse flow)', () => {
    const prevEdges: EdgeItem[] = [{ id: 'A-B', source: 'A', target: 'B' }];
    const edgeRecords: EdgeRecord[] = [{ id: 'A-B', source: 'A', target: 'B', direction: 'up' }];
    const prevDirections = new Map<string, EdgeDirection | null>([['A-B', 'down']]);

    expect(edgesAreStable(prevEdges, edgeRecords, prevDirections)).toBe(false);
  });

  it('detects direction change from active to null (reverse flow expires)', () => {
    const prevEdges: EdgeItem[] = [{ id: 'A-B', source: 'A', target: 'B' }];
    const edgeRecords: EdgeRecord[] = [{ id: 'A-B', source: 'A', target: 'B', direction: null }];
    const prevDirections = new Map<string, EdgeDirection | null>([['A-B', 'up']]);

    expect(edgesAreStable(prevEdges, edgeRecords, prevDirections)).toBe(false);
  });

  it('is stable when only non-topology data changes (same parent-child, same direction)', () => {
    // Simulates a poll update where sessions have new tokens/updatedAt but
    // the graph topology (which edges exist and their direction) is unchanged.
    const prevEdges: EdgeItem[] = [{ id: 'parent-child', source: 'parent', target: 'child' }];
    const edgeRecords: EdgeRecord[] = [
      { id: 'parent-child', source: 'parent', target: 'child', direction: null },
    ];
    const prevDirections = new Map<string, EdgeDirection | null>([['parent-child', null]]);

    // Even though the session data (tokens, updatedAt) may have changed,
    // the edge topology and direction are the same → edges should be stable
    expect(edgesAreStable(prevEdges, edgeRecords, prevDirections)).toBe(true);
  });
});
