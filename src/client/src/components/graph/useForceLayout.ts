import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Edge, Node, OnNodeDrag } from '@xyflow/react';
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type ForceLink,
  type Simulation,
  type SimulationLinkDatum,
} from 'd3-force';
import { collide, type RectCollisionNode } from './collide';

const NODE_WIDTH = 250;
const NODE_HEIGHT = 140;
const HALF_NODE_WIDTH = NODE_WIDTH / 2;
const HALF_NODE_HEIGHT = NODE_HEIGHT / 2;

const INITIAL_ALPHA = 0.45;
const ALPHA_MIN = 0.001;
const ALPHA_DECAY = 0.04;
const DRAG_REHEAT_ALPHA = 0.1;

const LINK_DISTANCE = 260;
const LINK_STRENGTH = 0.12;
const CHARGE_STRENGTH = -1200;

interface ForceLayoutNode extends RectCollisionNode {
  id: string;
}

/** Links use string IDs only (no numeric indices) — narrows SimulationLinkDatum */
interface ForceLayoutLink extends SimulationLinkDatum<ForceLayoutNode> {
  source: string | ForceLayoutNode;
  target: string | ForceLayoutNode;
}

interface UseForceLayoutParams {
  nodes: Node[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
}

interface UseForceLayoutResult {
  onNodeDragStart: OnNodeDrag;
  onNodeDragStop: OnNodeDrag;
}

function toSimulationCenter(node: Node) {
  return {
    x: node.position.x + HALF_NODE_WIDTH,
    y: node.position.y + HALF_NODE_HEIGHT,
  };
}

function syncDragPosition(
  simulationNodesById: Map<string, ForceLayoutNode>,
  node: Node,
  pinned: boolean,
): ForceLayoutNode | undefined {
  const simulationNode = simulationNodesById.get(node.id);
  if (!simulationNode) return undefined;

  const center = toSimulationCenter(node);
  simulationNode.x = center.x;
  simulationNode.y = center.y;
  simulationNode.fx = pinned ? center.x : null;
  simulationNode.fy = pinned ? center.y : null;
  return simulationNode;
}

export function useForceLayout({ nodes, edges, setNodes }: UseForceLayoutParams): UseForceLayoutResult {
  const simulationRef = useRef<Simulation<ForceLayoutNode, ForceLayoutLink> | null>(null);
  const linkForceRef = useRef<ForceLink<ForceLayoutNode, ForceLayoutLink> | null>(null);
  const simulationNodesByIdRef = useRef<Map<string, ForceLayoutNode>>(new Map());
  const frameRef = useRef<number | null>(null);
  const isTickingRef = useRef(false);
  const appliedLayoutKeysRef = useRef<{ nodeIdsKey: string; edgeLinksKey: string }>({
    nodeIdsKey: '',
    edgeLinksKey: '',
  });

  // One-time simulation initialization
  useEffect(() => {
    if (simulationRef.current != null && linkForceRef.current != null) return;

    const linkForce = forceLink<ForceLayoutNode, ForceLayoutLink>([])
      .id((node) => node.id)
      .distance(LINK_DISTANCE)
      .strength(LINK_STRENGTH);

    const simulation = forceSimulation<ForceLayoutNode>([])
      .alphaMin(ALPHA_MIN)
      .alphaDecay(ALPHA_DECAY)
      .force('link', linkForce)
      .force('charge', forceManyBody().strength(CHARGE_STRENGTH))
      .force(
        'collide',
        collide({
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        }),
      )
      .force('center', forceCenter(0, 0))
      .stop();

    simulationRef.current = simulation;
    linkForceRef.current = linkForce;
  }, []);

  const nodeIdsKey = useMemo(
    () => nodes.map((node) => node.id).sort((a, b) => a.localeCompare(b)).join('|'),
    [nodes],
  );

  const edgeLinksKey = useMemo(
    () => edges.map((edge) => `${edge.id}:${edge.source}:${edge.target}`).sort((a, b) => a.localeCompare(b)).join('|'),
    [edges],
  );

  const stopTicking = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    isTickingRef.current = false;
  }, []);

  const startTicking = useCallback(() => {
    if (isTickingRef.current) {
      return;
    }

    const simulation = simulationRef.current;

    if (!simulation) {
      return;
    }

    isTickingRef.current = true;

    const tick = () => {
      const currentSimulation = simulationRef.current;

      if (!currentSimulation) {
        stopTicking();
        return;
      }

      currentSimulation.tick();

      setNodes((currentNodes) => {
        let changed = false;

        const nextNodes = currentNodes.map((node) => {
          const simulationNode = simulationNodesByIdRef.current.get(node.id);

          if (!simulationNode) {
            return node;
          }

          if (node.dragging) {
            const center = toSimulationCenter(node);
            simulationNode.x = center.x;
            simulationNode.y = center.y;
            simulationNode.fx = center.x;
            simulationNode.fy = center.y;
            return node;
          }

          if (simulationNode.x == null || simulationNode.y == null) {
            return node;
          }

          const nextX = simulationNode.x - HALF_NODE_WIDTH;
          const nextY = simulationNode.y - HALF_NODE_HEIGHT;

          // Guard against NaN from d3-force numerical instability
          if (Number.isNaN(nextX) || Number.isNaN(nextY)) {
            return node;
          }

          if (Math.abs(node.position.x - nextX) < 0.1 && Math.abs(node.position.y - nextY) < 0.1) {
            return node;
          }

          changed = true;
          return {
            ...node,
            position: {
              x: nextX,
              y: nextY,
            },
          };
        });

        return changed ? nextNodes : currentNodes;
      });

      if (currentSimulation.alpha() <= currentSimulation.alphaMin()) {
        currentSimulation.stop();
        stopTicking();
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  }, [setNodes, stopTicking]);

  useEffect(() => {
    const simulation = simulationRef.current;
    const linkForce = linkForceRef.current;

    if (!simulation || !linkForce) {
      return;
    }

    const previousKeys = appliedLayoutKeysRef.current;
    const nodeIdsChanged = previousKeys.nodeIdsKey !== nodeIdsKey;
    const edgeLinksChanged = previousKeys.edgeLinksKey !== edgeLinksKey;

    if (!nodeIdsChanged && !edgeLinksChanged) {
      return;
    }

    appliedLayoutKeysRef.current = {
      nodeIdsKey,
      edgeLinksKey,
    };

    const nextNodeIds = new Set(nodes.map((node) => node.id));

    // Prune removed nodes
    for (const id of simulationNodesByIdRef.current.keys()) {
      if (!nextNodeIds.has(id)) {
        simulationNodesByIdRef.current.delete(id);
      }
    }

    // Single pass: update existing or create new simulation nodes, build array
    const simulationNodes: ForceLayoutNode[] = [];
    for (const node of nodes) {
      const existing = simulationNodesByIdRef.current.get(node.id);

      if (existing) {
        if (existing.x == null || existing.y == null) {
          const center = toSimulationCenter(node);
          existing.x = center.x;
          existing.y = center.y;
        }
        simulationNodes.push(existing);
        continue;
      }

      const center = toSimulationCenter(node);
      const simNode: ForceLayoutNode = { id: node.id, x: center.x, y: center.y };
      simulationNodesByIdRef.current.set(node.id, simNode);
      simulationNodes.push(simNode);
    }

    simulation.nodes(simulationNodes);

    const simulationLinks: ForceLayoutLink[] = edges
      .filter((edge) => nextNodeIds.has(edge.source) && nextNodeIds.has(edge.target))
      .map((edge) => ({
        source: edge.source,
        target: edge.target,
      }));

    linkForce.links(simulationLinks);

    if (simulationNodes.length > 0) {
      let totalX = 0;
      let totalY = 0;

      for (const node of simulationNodes) {
        totalX += node.x ?? 0;
        totalY += node.y ?? 0;
      }

      simulation.force('center', forceCenter(totalX / simulationNodes.length, totalY / simulationNodes.length));
    }

    if (simulationNodes.length === 0) {
      simulation.stop();
      stopTicking();
      return;
    }

    // Reheat on node ID changes or edge changes
    if (nodeIdsChanged || edgeLinksChanged) {
      simulation.alpha(INITIAL_ALPHA);
      simulation.alphaTarget(0);
      startTicking();
    }
  }, [nodes, edges, nodeIdsKey, edgeLinksKey, startTicking, stopTicking]);

  const onNodeDragStart = useCallback<OnNodeDrag>(
    (_event, node) => syncDragPosition(simulationNodesByIdRef.current, node, true),
    [],
  );

  const onNodeDragStop = useCallback<OnNodeDrag>(
    (_event, node) => {
      syncDragPosition(simulationNodesByIdRef.current, node, false);

      // Gentle reheat so other nodes adjust to the new position
      const simulation = simulationRef.current;
      if (simulation) {
        simulation.alpha(DRAG_REHEAT_ALPHA);
        startTicking();
      }
    },
    [startTicking],
  );

  useEffect(() => {
    return () => {
      stopTicking();
      simulationRef.current?.stop();
    };
  }, [stopTicking]);

  return {
    onNodeDragStart,
    onNodeDragStop,
  };
}
