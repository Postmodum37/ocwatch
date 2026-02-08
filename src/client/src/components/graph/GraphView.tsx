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
      const positionMap = new Map(currentNodes.map((n) => [n.id, n.position]));
      
      const nextNodes: Node[] = sessions.map((session, index) => {
        const existingPos = positionMap.get(session.id);
        // Stagger initial positions to avoid all-at-origin explosion
        const initialPos = { x: (index % 3) * 300, y: Math.floor(index / 3) * 200 };
        return {
          id: session.id,
          type: 'agentNode',
          data: session as unknown as Record<string, unknown>,
          position: existingPos || initialPos,
        };
      });
      
      return nextNodes;
    });

    setEdges(() => {
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

      const nextEdges: Edge[] = [];

      for (const session of sessions) {
        if (!session.parentID || !sessionMap.has(session.parentID)) continue;

        // Determine edge direction based on child status
        let direction: EdgeDirection = null;
        if (session.status === 'working') {
          direction = 'down'; // Child actively working → delegation flow
        } else if (reverseFlowEdges.current.has(session.id)) {
          direction = 'up'; // Child just completed → result return flow
        }

        nextEdges.push({
          id: `${session.parentID}-${session.id}`,
          source: session.parentID,
          target: session.id,
          type: 'animatedEdge',
          data: { direction },
        });
      }
      
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
