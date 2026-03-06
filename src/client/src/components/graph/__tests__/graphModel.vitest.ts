import { describe, expect, it, vi } from 'vitest';
import type { ActivitySession } from '@shared/types';
import { buildGraphModel } from '../graphModel';

function makeSession(overrides: Partial<ActivitySession> = {}): ActivitySession {
  return {
    id: 'ses_root',
    title: 'Root',
    agent: 'planner',
    nodeKind: 'session',
    status: 'working',
    activityType: 'tool',
    currentAction: 'Running task',
    createdAt: new Date('2026-03-06T00:00:00.000Z'),
    updatedAt: new Date('2026-03-06T00:00:10.000Z'),
    toolCalls: [],
    ...overrides,
  };
}

describe('buildGraphModel', () => {
  it('keeps node positions stable for status-only updates', () => {
    const sessions = [
      makeSession({ id: 'ses_root', parentID: undefined }),
      makeSession({
        id: 'ses_child',
        parentID: 'ses_root',
        agent: 'worker',
        status: 'idle',
        activityType: 'idle',
      }),
    ];

    const first = buildGraphModel({
      sessions,
      direction: 'TB',
      focusedNodeId: null,
      focusActive: false,
      showCompleted: true,
      expandedNodeIds: new Set(),
      reverseFlowNodeIds: new Set(),
      reducedMotion: false,
      onToggleCollapse: vi.fn(),
    });

    const updated = buildGraphModel({
      sessions: [
        makeSession({ id: 'ses_root', parentID: undefined, currentAction: 'Updated', tokens: 99 }),
        makeSession({
          id: 'ses_child',
          parentID: 'ses_root',
          agent: 'worker',
          status: 'working',
          activityType: 'tool',
          currentAction: 'Working now',
        }),
      ],
      direction: 'TB',
      focusedNodeId: null,
      focusActive: false,
      showCompleted: true,
      expandedNodeIds: new Set(),
      reverseFlowNodeIds: new Set(['ses_child']),
      reducedMotion: false,
      onToggleCollapse: vi.fn(),
    });

    expect(first.nodes.map((node) => node.position)).toEqual(
      updated.nodes.map((node) => node.position),
    );
  });

  it('collapses inactive completed branches when focusActive is enabled', () => {
    const sessions = [
      makeSession({ id: 'ses_root', parentID: undefined, status: 'working' }),
      makeSession({
        id: 'ses_completed_parent',
        parentID: 'ses_root',
        agent: 'worker',
        status: 'completed',
        activityType: 'idle',
      }),
      makeSession({
        id: 'ses_completed_leaf',
        parentID: 'ses_completed_parent',
        agent: 'worker-2',
        status: 'completed',
        activityType: 'idle',
      }),
      makeSession({
        id: 'ses_active',
        parentID: 'ses_root',
        agent: 'executor',
        status: 'working',
        activityType: 'tool',
      }),
    ];

    const model = buildGraphModel({
      sessions,
      direction: 'TB',
      focusedNodeId: null,
      focusActive: true,
      showCompleted: true,
      expandedNodeIds: new Set(),
      reverseFlowNodeIds: new Set(),
      reducedMotion: false,
      onToggleCollapse: vi.fn(),
    });

    expect(model.nodes.map((node) => node.id)).toContain('ses_completed_parent');
    expect(model.nodes.map((node) => node.id)).not.toContain('ses_completed_leaf');
    const collapsedNode = model.nodes.find((node) => node.id === 'ses_completed_parent');
    expect(collapsedNode?.data.collapsedDescendantCount).toBe(1);
  });

  it('highlights lineage and descendants for the focused node', () => {
    const sessions = [
      makeSession({ id: 'ses_root', parentID: undefined, status: 'working' }),
      makeSession({ id: 'ses_child', parentID: 'ses_root', agent: 'worker' }),
      makeSession({ id: 'ses_grandchild', parentID: 'ses_child', agent: 'worker-2' }),
      makeSession({ id: 'ses_sibling', parentID: 'ses_root', agent: 'worker-3' }),
    ];

    const model = buildGraphModel({
      sessions,
      direction: 'TB',
      focusedNodeId: 'ses_child',
      focusActive: false,
      showCompleted: true,
      expandedNodeIds: new Set(),
      reverseFlowNodeIds: new Set(),
      reducedMotion: false,
      onToggleCollapse: vi.fn(),
    });

    const byId = new Map(model.nodes.map((node) => [node.id, node]));
    expect(byId.get('ses_root')?.data.isDimmed).toBe(false);
    expect(byId.get('ses_child')?.data.isDimmed).toBe(false);
    expect(byId.get('ses_grandchild')?.data.isDimmed).toBe(false);
    expect(byId.get('ses_sibling')?.data.isDimmed).toBe(true);
  });
});
