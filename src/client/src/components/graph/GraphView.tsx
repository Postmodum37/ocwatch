import React, { useEffect, useMemo } from 'react';
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
import AnimatedEdge from './AnimatedEdge';
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

export const GraphView: React.FC<GraphViewProps> = ({ sessions, loading }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes((currentNodes) => {
      const positionMap = new Map(currentNodes.map((n) => [n.id, n.position]));
      
      const nextNodes: Node[] = sessions.map((session) => {
        const existingPos = positionMap.get(session.id);
        return {
          id: session.id,
          type: 'agentNode',
          data: session as any,
          position: existingPos || { x: 0, y: 0 },
        };
      });
      
      return nextNodes;
    });

    setEdges((_currentEdges) => {
      const sessionIds = new Set(sessions.map((s) => s.id));
      const nextEdges: Edge[] = [];

      sessions.forEach((session) => {
        if (session.parentID && sessionIds.has(session.parentID)) {
          const parentSession = sessions.find(s => s.id === session.parentID);
          const isSourceWorking = parentSession?.status === 'working';
          const isTargetWorking = session.status === 'working';
          const isActive = isSourceWorking || isTargetWorking;

          nextEdges.push({
            id: `${session.parentID}-${session.id}`,
            source: session.parentID,
            target: session.id,
            type: 'animatedEdge',
            data: { active: isActive },
          });
        }
      });
      
      return nextEdges;
    });
  }, [sessions, setNodes, setEdges]);

  const { onNodeDragStart, onNodeDragStop } = useForceLayout({
    nodes,
    edges,
    setNodes,
  });

  const isWorking = useMemo(() => sessions.some((s) => s.status === 'working'), [sessions]);

  if (loading && sessions.length === 0) {
    return (
      <div className="h-full w-full bg-surface overflow-hidden flex flex-col" data-testid="graph-view-loading">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Live Activity</h3>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="h-full w-full bg-surface overflow-hidden flex flex-col" data-testid="graph-view-empty">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Live Activity</h3>
        </div>
        <EmptyState
          icon={Activity}
          title="No Activity"
          description="Select a session to view live activity"
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-surface overflow-hidden flex flex-col" data-testid="graph-view">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface z-10">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Live Activity</h3>
          {isWorking && (
             <span className="relative flex h-2 w-2" title="Activity in progress">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
               <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
             </span>
          )}
        </div>
      </div>
      
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
          proOptions={{ hideAttribution: true }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background color="#374151" gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
};
