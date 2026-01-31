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

interface AgentTreeProps {
  sessions: SessionMetadata[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const nodeWidth = 250;
const nodeHeight = 50;

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

const AgentTree: React.FC<AgentTreeProps> = ({ sessions, selectedId, onSelect }) => {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const sessionIds = new Set(sessions.map(s => s.id));

    sessions.forEach((session) => {
      const isSelected = session.id === selectedId;
      
      nodes.push({
        id: session.id,
        data: { 
          label: session.title || session.id,
          session 
        },
        position: { x: 0, y: 0 },
        style: {
          background: '#1e1e1e',
          color: '#e5e7eb',
          border: isSelected ? '2px solid #3b82f6' : '1px solid #374151',
          borderRadius: '8px',
          width: nodeWidth,
          fontSize: '12px',
          padding: '10px',
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
      <div className="flex items-center justify-center h-full text-gray-500" data-testid="agent-tree-empty">
        No active sessions
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
