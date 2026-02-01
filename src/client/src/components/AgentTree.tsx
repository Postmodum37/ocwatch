import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Position,
  ConnectionLineType,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import type { SessionMetadata } from '../../../shared/types';
import { Network } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface AgentTreeProps {
  sessions: SessionMetadata[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const nodeWidth = 250;
const nodeHeight = 72;

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: 'TB' });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // Shift dagre node position (center-anchored) to React Flow (top-left anchored)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };
  });

  return { nodes: layoutedNodes, edges };
};

const getAgentColor = (agent: string | null | undefined): string => {
  const lowerAgent = agent?.toLowerCase() || '';
  if (lowerAgent.includes('sisyphus')) return '#3b82f6'; // blue
  if (lowerAgent.includes('prometheus')) return '#a855f7'; // purple
  if (lowerAgent.includes('explore') || lowerAgent.includes('librarian')) return '#22c55e'; // green
  if (lowerAgent.includes('oracle')) return '#f59e0b'; // amber
  if (lowerAgent.includes('build')) return '#06b6d4'; // cyan
  return '#6b7280'; // gray fallback
};

const AgentTree: React.FC<AgentTreeProps> = ({ sessions, selectedId, onSelect }) => {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const sessionIds = new Set(sessions.map(s => s.id));

    sessions.forEach((session) => {
      const isSelected = session.id === selectedId;
      const isRoot = !session.parentID;
      const modelDisplay = [session.providerID, session.modelID].filter(Boolean).join('/');

      nodes.push({
        id: session.id,
        data: { 
          label: (
            <div className="flex flex-col text-left h-full justify-center">
              <div 
                className={`font-medium truncate ${isRoot ? 'text-sm' : 'text-xs'}`} 
                title={session.title || session.id}
              >
                {!isRoot && <span className="text-gray-400 font-normal">TASK: </span>}
                {session.title || session.id}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                {session.agent && (
                  <span 
                    className="px-1.5 py-0.5 rounded text-white font-medium"
                    style={{ backgroundColor: getAgentColor(session.agent) }}
                  >
                    {session.agent}
                  </span>
                )}
                {modelDisplay && (
                  <span className="truncate opacity-75" title={modelDisplay}>
                    {modelDisplay}
                  </span>
                )}
              </div>
            </div>
          ),
          session 
        },
        position: { x: 0, y: 0 },
        style: {
          background: '#1e1e1e',
          color: '#e5e7eb',
          border: isSelected 
            ? '2px solid #3b82f6' 
            : isRoot 
              ? '2px solid #4b5563' 
              : '1px solid #374151',
          borderRadius: '8px',
          width: nodeWidth,
          height: nodeHeight,
          fontSize: '12px',
          padding: '8px 12px',
        },
      });

      if (session.parentID && sessionIds.has(session.parentID)) {
        edges.push({
          id: `${session.parentID}-${session.id}`,
          source: session.parentID,
          target: session.id,
          type: ConnectionLineType.SmoothStep,
          animated: true,
          style: { stroke: '#4b5563' },
        });
      }
    });

    return getLayoutedElements(nodes, edges);
  }, [sessions, selectedId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    onSelect(node.id);
  }, [onSelect]);

  if (sessions.length === 0) {
    return (
      <div data-testid="agent-tree-empty">
        <EmptyState
          icon={Network}
          title="No Active Sessions"
          description="Start a new OpenCode session to see the agent hierarchy here"
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full" data-testid="agent-tree">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color="#374151" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default AgentTree;
