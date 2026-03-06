import type { Edge, Node, XYPosition } from '@xyflow/react';
import type { ActivitySession } from '@shared/types';
import type { EdgeDirection } from './AnimatedEdge';
import type { GraphDirection, GraphEdgeData, GraphNodeData } from './types';

const NODE_WIDTH = 320;
const NODE_HEIGHT = 140;
const SIBLING_GAP = 72;
const ROOT_GAP = 120;
const LEVEL_GAP = 120;

interface BuildGraphModelOptions {
  sessions: ActivitySession[];
  direction: GraphDirection;
  focusedNodeId: string | null;
  focusActive: boolean;
  showCompleted: boolean;
  expandedNodeIds: Set<string>;
  reverseFlowNodeIds: Set<string>;
  reducedMotion: boolean;
  onToggleCollapse: (nodeId: string) => void;
}

export interface GraphModelResult {
  nodes: Node<GraphNodeData>[];
  edges: Edge<GraphEdgeData>[];
  visibleNodeCount: number;
  hiddenCompletedCount: number;
  structureKey: string;
}

function compareSessions(a: ActivitySession, b: ActivitySession): number {
  const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (createdDiff !== 0) {
    return createdDiff;
  }

  return a.id.localeCompare(b.id);
}

function isActiveSession(session: ActivitySession): boolean {
  return session.status !== 'completed';
}

function buildAncestorSet(
  nodeId: string,
  sessionById: Map<string, ActivitySession>,
): Set<string> {
  const ancestors = new Set<string>();
  let current = sessionById.get(nodeId);

  while (current?.parentID) {
    ancestors.add(current.parentID);
    current = sessionById.get(current.parentID);
  }

  return ancestors;
}

function buildDescendantSet(
  rootId: string,
  childrenById: Map<string, ActivitySession[]>,
): Set<string> {
  const descendants = new Set<string>();
  const stack = [...(childrenById.get(rootId) ?? [])];

  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) {
      continue;
    }
    descendants.add(next.id);
    stack.push(...(childrenById.get(next.id) ?? []));
  }

  return descendants;
}

function computeTreePositions(
  rootIds: string[],
  childrenById: Map<string, ActivitySession[]>,
  direction: GraphDirection,
): Map<string, XYPosition> {
  const subtreeWidthCache = new Map<string, number>();
  const positions = new Map<string, XYPosition>();

  const measureSubtree = (nodeId: string): number => {
    const cached = subtreeWidthCache.get(nodeId);
    if (cached !== undefined) {
      return cached;
    }

    const children = childrenById.get(nodeId) ?? [];
    if (children.length === 0) {
      subtreeWidthCache.set(nodeId, NODE_WIDTH);
      return NODE_WIDTH;
    }

    let total = 0;
    for (const child of children) {
      total += measureSubtree(child.id);
    }
    total += SIBLING_GAP * Math.max(0, children.length - 1);

    const width = Math.max(NODE_WIDTH, total);
    subtreeWidthCache.set(nodeId, width);
    return width;
  };

  const assign = (nodeId: string, left: number, depth: number) => {
    const children = childrenById.get(nodeId) ?? [];
    const subtreeWidth = measureSubtree(nodeId);
    const baseX = left + subtreeWidth / 2 - NODE_WIDTH / 2;
    const baseY = depth * (NODE_HEIGHT + LEVEL_GAP);

    positions.set(
      nodeId,
      direction === 'TB'
        ? { x: baseX, y: baseY }
        : { x: baseY, y: baseX },
    );

    if (children.length === 0) {
      return;
    }

    const childWidths = children.map((child) => measureSubtree(child.id));
    const totalChildrenWidth =
      childWidths.reduce((sum, width) => sum + width, 0) +
      SIBLING_GAP * Math.max(0, children.length - 1);
    let childLeft = left + (subtreeWidth - totalChildrenWidth) / 2;

    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      const childWidth = childWidths[index];
      assign(child.id, childLeft, depth + 1);
      childLeft += childWidth + SIBLING_GAP;
    }
  };

  let nextRootLeft = 0;
  for (const rootId of rootIds) {
    const width = measureSubtree(rootId);
    assign(rootId, nextRootLeft, 0);
    nextRootLeft += width + ROOT_GAP;
  }

  return positions;
}

export function buildGraphModel({
  sessions,
  direction,
  focusedNodeId,
  focusActive,
  showCompleted,
  expandedNodeIds,
  reverseFlowNodeIds,
  reducedMotion,
  onToggleCollapse,
}: BuildGraphModelOptions): GraphModelResult {
  const sessionById = new Map<string, ActivitySession>();
  const childrenById = new Map<string, ActivitySession[]>();

  for (const session of sessions) {
    sessionById.set(session.id, session);
  }

  const roots = sessions
    .filter((session) => !session.parentID || !sessionById.has(session.parentID))
    .sort(compareSessions);

  for (const session of sessions) {
    if (!session.parentID || !sessionById.has(session.parentID)) {
      continue;
    }

    const siblings = childrenById.get(session.parentID);
    if (siblings) {
      siblings.push(session);
    } else {
      childrenById.set(session.parentID, [session]);
    }
  }

  for (const children of childrenById.values()) {
    children.sort(compareSessions);
  }

  const descendantCount = new Map<string, number>();
  const hasActiveDescendant = new Map<string, boolean>();

  const walkState = (nodeId: string): { descendants: number; hasActive: boolean } => {
    const children = childrenById.get(nodeId) ?? [];
    let descendants = 0;
    let subtreeHasActive = false;

    for (const child of children) {
      const childState = walkState(child.id);
      descendants += childState.descendants + 1;
      subtreeHasActive = subtreeHasActive || isActiveSession(child) || childState.hasActive;
    }

    descendantCount.set(nodeId, descendants);
    hasActiveDescendant.set(nodeId, subtreeHasActive);
    return { descendants, hasActive: subtreeHasActive };
  };

  for (const root of roots) {
    walkState(root.id);
  }

  const visibleIds = new Set<string>();
  const collapsedDescendantCount = new Map<string, number>();

  const isInactiveCompletedLeaf = (session: ActivitySession) =>
    session.status === 'completed' &&
    !hasActiveDescendant.get(session.id) &&
    (descendantCount.get(session.id) ?? 0) === 0;

  const shouldAutoCollapse = (session: ActivitySession) =>
    (focusActive || !showCompleted) &&
    session.status === 'completed' &&
    !hasActiveDescendant.get(session.id) &&
    (descendantCount.get(session.id) ?? 0) > 0 &&
    !expandedNodeIds.has(session.id);

  const markVisible = (nodeId: string, forceVisible = false) => {
    const session = sessionById.get(nodeId);
    if (!session) {
      return;
    }

    if (!forceVisible && (focusActive || !showCompleted) && isInactiveCompletedLeaf(session)) {
      return;
    }

    visibleIds.add(nodeId);

    if (shouldAutoCollapse(session)) {
      collapsedDescendantCount.set(nodeId, descendantCount.get(nodeId) ?? 0);
      return;
    }

    const children = childrenById.get(nodeId) ?? [];
    for (const child of children) {
      markVisible(child.id);
    }
  };

  for (const root of roots) {
    markVisible(root.id, true);
  }

  const visibleChildrenById = new Map<string, ActivitySession[]>();
  for (const [parentId, children] of childrenById) {
    const visibleChildren = children.filter((child) => visibleIds.has(child.id));
    if (visibleChildren.length > 0) {
      visibleChildrenById.set(parentId, visibleChildren);
    }
  }

  const visibleRoots = roots.filter((root) => visibleIds.has(root.id));
  const positions = computeTreePositions(
    visibleRoots.map((root) => root.id),
    visibleChildrenById,
    direction,
  );

  const highlightedIds = new Set<string>();
  if (focusedNodeId && visibleIds.has(focusedNodeId)) {
    highlightedIds.add(focusedNodeId);
    for (const ancestorId of buildAncestorSet(focusedNodeId, sessionById)) {
      highlightedIds.add(ancestorId);
    }
    for (const descendantId of buildDescendantSet(focusedNodeId, visibleChildrenById)) {
      highlightedIds.add(descendantId);
    }
  }

  const nodes: Node<GraphNodeData>[] = sessions
    .filter((session) => visibleIds.has(session.id))
    .map((session) => ({
      id: session.id,
      type: 'agentNode',
      position: positions.get(session.id) ?? { x: 0, y: 0 },
      draggable: false,
      selectable: false,
      data: {
        session,
        isFocused: focusedNodeId === session.id,
        isDimmed: highlightedIds.size > 0 && !highlightedIds.has(session.id),
        collapsedDescendantCount: collapsedDescendantCount.get(session.id) ?? 0,
        onToggleCollapse,
      },
    }));

  const edges: Edge<GraphEdgeData>[] = sessions
    .filter((session) => session.parentID && visibleIds.has(session.id) && visibleIds.has(session.parentID))
    .map((session) => {
      let directionForEdge: EdgeDirection = null;
      if (session.status === 'working') {
        directionForEdge = 'down';
      } else if (reverseFlowNodeIds.has(session.id)) {
        directionForEdge = 'up';
      }

      const highlighted =
        highlightedIds.size === 0 ||
        (session.parentID ? highlightedIds.has(session.parentID) && highlightedIds.has(session.id) : false);

      return {
        id: `${session.parentID}-${session.id}`,
        source: session.parentID!,
        target: session.id,
        type: 'animatedEdge',
        selectable: false,
        data: {
          direction: directionForEdge,
          isDimmed: !highlighted,
          reducedMotion,
        },
      };
    });

  return {
    nodes,
    edges,
    visibleNodeCount: nodes.length,
    hiddenCompletedCount: Math.max(0, sessions.length - nodes.length),
    structureKey: [
      direction,
      focusActive ? 'focus' : 'all',
      showCompleted ? 'show' : 'hide',
      Array.from(expandedNodeIds).sort().join('|'),
      nodes.map((node) => node.id).sort().join('|'),
      edges.map((edge) => edge.id).sort().join('|'),
    ].join('::'),
  };
}
