import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Activity } from 'lucide-react';
import type { ActivitySession } from '@shared/types';
import { EmptyState } from '../EmptyState';
import { LoadingSkeleton } from '../LoadingSkeleton';
import { AgentNode } from './AgentNode';
import { AnimatedEdge, type EdgeDirection } from './AnimatedEdge';
import { useForceLayout } from './useForceLayout';

interface GraphViewProps {
  sessions: ActivitySession[];
  loading: boolean;
}

const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
};

const edgeTypes: EdgeTypes = {
  animatedEdge: AnimatedEdge,
};

function getSessionFingerprint(session: ActivitySession): string {
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

/** Shared layout wrapper for all graph states */
function GraphShell({ children, testId, headerRight }: { children: React.ReactNode; testId?: string; headerRight?: React.ReactNode }) {
  return (
    <div className="h-full w-full bg-surface overflow-hidden flex flex-col" data-testid={testId}>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface z-10">
        <h3 className="font-semibold text-sm">Live Activity</h3>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

/** Duration (ms) for reverse-flow animation after a child completes */
const REVERSE_FLOW_DURATION = 3000;

export const GraphView: React.FC<GraphViewProps> = ({ sessions, loading }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Track previous statuses to detect working→completed transitions
  const prevStatusMap = useRef<Map<string, string>>(new Map());
  const reverseFlowEdges = useRef<Set<string>>(new Set());
  const reverseFlowTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prevNodeFingerprintsRef = useRef<Map<string, string>>(new Map());
  const prevEdgeDirectionsRef = useRef<Map<string, EdgeDirection | null>>(new Map());

  // Force edge re-render when reverse flow expires
  const triggerEdgeUpdate = useCallback(() => {
    setEdges((prev) => [...prev]);
  }, [setEdges]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = reverseFlowTimers.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    setNodes((currentNodes) => {
      const nextFingerprints = new Map(sessions.map((session) => [session.id, getSessionFingerprint(session)]));
      const prevFingerprints = prevNodeFingerprintsRef.current;
      const hasSameIds =
        currentNodes.length === nextFingerprints.size &&
        currentNodes.every((node) => nextFingerprints.has(node.id));
      const hasSameFingerprints =
        hasSameIds &&
        currentNodes.every((node) => prevFingerprints.get(node.id) === nextFingerprints.get(node.id));

      if (hasSameFingerprints) {
        prevNodeFingerprintsRef.current = nextFingerprints;
        return currentNodes;
      }

      const positionMap = new Map(currentNodes.map((n) => [n.id, n.position]));
      const currentNodeMap = new Map(currentNodes.map((node) => [node.id, node]));

      const nextNodes: Node[] = sessions.map((session, index) => {
        const existingNode = currentNodeMap.get(session.id);
        const existingPos = positionMap.get(session.id);
        // Stagger initial positions to avoid all-at-origin explosion
        const initialPos = { x: (index % 3) * 300, y: Math.floor(index / 3) * 200 };

        if (existingNode && prevFingerprints.get(session.id) === nextFingerprints.get(session.id)) {
          return existingNode;
        }

        return {
          id: session.id,
          type: 'agentNode',
          // ReactFlow Node.data requires Record<string, unknown>; AgentNode casts back with runtime guard
          data: session as unknown as Record<string, unknown>,
          position: existingPos || initialPos,
        };
      });

      prevNodeFingerprintsRef.current = nextFingerprints;
      return nextNodes;
    });

    setEdges((prevEdges) => {
      const sessionMap = new Map(sessions.map((s) => [s.id, s]));

      // Detect child completion transitions: working → completed
      for (const session of sessions) {
        if (!session.parentID) continue;
        const prevStatus = prevStatusMap.current.get(session.id);
        const currStatus = session.status;
        const parentSession = sessionMap.get(session.parentID);

        if (
          prevStatus === 'working' &&
          currStatus === 'completed' &&
          parentSession?.status === 'working'
        ) {
          reverseFlowEdges.current.add(session.id);
          // Clear existing timer if any
          const existing = reverseFlowTimers.current.get(session.id);
          if (existing) clearTimeout(existing);
          // Auto-expire reverse flow after duration
          reverseFlowTimers.current.set(
            session.id,
            setTimeout(() => {
              reverseFlowEdges.current.delete(session.id);
              reverseFlowTimers.current.delete(session.id);
              triggerEdgeUpdate();
            }, REVERSE_FLOW_DURATION),
          );
        }
      }
      prevStatusMap.current = new Map(sessions.map((s) => [s.id, s.status ?? 'idle']));

      const edgeRecords: Array<{ id: string; source: string; target: string; direction: EdgeDirection }> = [];
      const nextEdgeDirections = new Map<string, EdgeDirection | null>();

      for (const session of sessions) {
        if (!session.parentID || !sessionMap.has(session.parentID)) continue;

        // Determine edge direction based on child status
        let direction: EdgeDirection = null;
        if (session.status === 'working') {
          direction = 'down'; // Child actively working → delegation flow
        } else if (reverseFlowEdges.current.has(session.id)) {
          direction = 'up'; // Child just completed → result return flow
        }

        const edgeId = `${session.parentID}-${session.id}`;
        nextEdgeDirections.set(edgeId, direction);
        edgeRecords.push({
          id: edgeId,
          source: session.parentID,
          target: session.id,
          direction,
        });
      }

      const topologyUnchanged =
        prevEdges.length === edgeRecords.length &&
        prevEdges.every((edge) => {
          const nextRecord = edgeRecords.find((record) => record.id === edge.id);
          return !!nextRecord && edge.source === nextRecord.source && edge.target === nextRecord.target;
        });
      const prevDirections = prevEdgeDirectionsRef.current;
      const directionsUnchanged =
        topologyUnchanged &&
        prevDirections.size === nextEdgeDirections.size &&
        edgeRecords.every((record) => prevDirections.get(record.id) === nextEdgeDirections.get(record.id));

      if (topologyUnchanged && directionsUnchanged) {
        prevEdgeDirectionsRef.current = nextEdgeDirections;
        return prevEdges;
      }

      const nextEdges: Edge[] = edgeRecords.map((record) => ({
        id: record.id,
        source: record.source,
        target: record.target,
        type: 'animatedEdge',
        data: { direction: record.direction },
      }));

      prevEdgeDirectionsRef.current = nextEdgeDirections;
      return nextEdges;
    });
  }, [sessions, setNodes, setEdges, triggerEdgeUpdate]);

  const { onNodeDragStart, onNodeDragStop } = useForceLayout({
    nodes,
    edges,
    setNodes,
  });

  const isWorking = useMemo(() => sessions.some((s) => s.status === 'working'), [sessions]);

  if (loading && sessions.length === 0) {
    return (
      <GraphShell testId="graph-view-loading">
        <LoadingSkeleton />
      </GraphShell>
    );
  }

  if (sessions.length === 0) {
    return (
      <GraphShell testId="graph-view-empty">
        <EmptyState
          icon={Activity}
          title="No Activity"
          description="Select a session to view live activity"
        />
      </GraphShell>
    );
  }

  return (
    <GraphShell
      testId="graph-view"
      headerRight={
        isWorking ? (
          <span className="relative flex h-2 w-2" title="Activity in progress">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
        ) : undefined
      }
    >
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          fitView
          nodesDraggable={true}
          nodesConnectable={false}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background color="#374151" gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </GraphShell>
  );
};
