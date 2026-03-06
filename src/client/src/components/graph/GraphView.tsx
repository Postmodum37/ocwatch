import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Activity, Eye, EyeOff, Maximize2, Rows3, Target } from 'lucide-react';
import type { ActivitySession } from '@shared/types';
import { formatRelativeTime } from '@shared/utils/formatTime';
import { EmptyState } from '../EmptyState';
import { LoadingSkeleton } from '../LoadingSkeleton';
import { AgentNode } from './AgentNode';
import { AnimatedEdge } from './AnimatedEdge';
import { buildGraphModel } from './graphModel';
import type { GraphDirection, GraphEdgeData, GraphNodeData } from './types';

interface GraphViewProps {
  rootSessionId: string;
  sessions: ActivitySession[];
  loading: boolean;
}

const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
};

const edgeTypes: EdgeTypes = {
  animatedEdge: AnimatedEdge,
};

const REVERSE_FLOW_DURATION_MS = 2500;

function GraphShell({
  children,
  testId,
  headerRight,
}: {
  children: React.ReactNode;
  testId?: string;
  headerRight?: React.ReactNode;
}) {
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

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}

export const GraphView: React.FC<GraphViewProps> = ({ rootSessionId, sessions, loading }) => {
  const reducedMotion = useReducedMotion();
  const reactFlowRef = useRef<ReactFlowInstance<Node<GraphNodeData>, Edge<GraphEdgeData>> | null>(null);
  const previousRootIdRef = useRef<string | null>(null);
  const previousStatusMapRef = useRef<Map<string, string>>(new Map());
  const reverseFlowTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [direction, setDirection] = useState<GraphDirection>('TB');
  const [showCompleted, setShowCompleted] = useState(true);
  const [focusActiveOverride, setFocusActiveOverride] = useState<boolean | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [reverseFlowNodeIds, setReverseFlowNodeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDirection('TB');
    setShowCompleted(true);
    setFocusActiveOverride(null);
    setFocusedNodeId(null);
    setExpandedNodeIds(new Set());
    setReverseFlowNodeIds(new Set());
    previousStatusMapRef.current = new Map();
  }, [rootSessionId]);

  useEffect(() => {
    const timers = reverseFlowTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const sessionMap = new Map(sessions.map((session) => [session.id, session]));

    for (const session of sessions) {
      if (!session.parentID) {
        continue;
      }

      const previousStatus = previousStatusMapRef.current.get(session.id);
      const currentStatus = session.status ?? 'completed';
      const parentSession = sessionMap.get(session.parentID);
      const parentWorking = parentSession?.status === 'working' || parentSession?.status === 'waiting';

      if (previousStatus === 'working' && currentStatus === 'completed' && parentWorking) {
        setReverseFlowNodeIds((prev) => {
          const next = new Set(prev);
          next.add(session.id);
          return next;
        });

        const existingTimer = reverseFlowTimersRef.current.get(session.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        reverseFlowTimersRef.current.set(
          session.id,
          setTimeout(() => {
            reverseFlowTimersRef.current.delete(session.id);
            setReverseFlowNodeIds((prev) => {
              if (!prev.has(session.id)) {
                return prev;
              }
              const next = new Set(prev);
              next.delete(session.id);
              return next;
            });
          }, REVERSE_FLOW_DURATION_MS),
        );
      }
    }

    previousStatusMapRef.current = new Map(
      sessions.map((session) => [session.id, session.status ?? 'completed']),
    );
  }, [sessions]);

  const toggleCollapse = useCallback((nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const focusActive = focusActiveOverride ?? sessions.length > 80;

  const graphModel = useMemo(
    () =>
      buildGraphModel({
        sessions,
        direction,
        focusedNodeId,
        focusActive,
        showCompleted,
        expandedNodeIds,
        reverseFlowNodeIds,
        reducedMotion,
        onToggleCollapse: toggleCollapse,
      }),
    [
      sessions,
      direction,
      focusedNodeId,
      focusActive,
      showCompleted,
      expandedNodeIds,
      reverseFlowNodeIds,
      reducedMotion,
      toggleCollapse,
    ],
  );

  const fitGraph = useCallback(() => {
    if (!reactFlowRef.current || graphModel.visibleNodeCount === 0) {
      return;
    }

    void reactFlowRef.current.fitView({
      padding: 0.18,
      duration: reducedMotion ? 0 : 220,
      includeHiddenNodes: false,
    });
  }, [graphModel.visibleNodeCount, reducedMotion]);

  useEffect(() => {
    if (previousRootIdRef.current === rootSessionId) {
      return;
    }

    previousRootIdRef.current = rootSessionId;
    if (graphModel.visibleNodeCount === 0) {
      return;
    }

    requestAnimationFrame(() => {
      fitGraph();
    });
  }, [rootSessionId, graphModel.visibleNodeCount, fitGraph]);

  const handleNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    setFocusedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setFocusedNodeId(null);
  }, []);

  const focusedSession = useMemo(
    () => sessions.find((session) => session.id === focusedNodeId) ?? null,
    [sessions, focusedNodeId],
  );

  const isWorking = useMemo(
    () => sessions.some((session) => session.status === 'working' || session.status === 'waiting'),
    [sessions],
  );
  const activeCount = useMemo(
    () => sessions.filter((session) => session.status === 'working' || session.status === 'waiting' || session.status === 'idle').length,
    [sessions],
  );

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
          description="Session activity will appear here when messages and tools start flowing."
        />
      </GraphShell>
    );
  }

  return (
    <GraphShell
      testId="graph-view"
      headerRight={
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span>{activeCount} active</span>
          <span>{graphModel.visibleNodeCount} shown</span>
          {graphModel.hiddenCompletedCount > 0 && (
            <span>{graphModel.hiddenCompletedCount} hidden</span>
          )}
          {isWorking ? (
            <span className="relative flex h-2 w-2" title="Activity in progress">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
            </span>
          ) : undefined}
        </div>
      }
    >
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={graphModel.nodes}
          edges={graphModel.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={(instance) => {
            reactFlowRef.current = instance;
            fitGraph();
          }}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          fitViewOptions={{ padding: 0.18 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          selectionOnDrag={false}
          onlyRenderVisibleElements={graphModel.visibleNodeCount > 120}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background color="#374151" gap={16} />
          <Controls showInteractive={false} />
          {graphModel.visibleNodeCount > 30 ? (
            <MiniMap
              pannable
              zoomable
              nodeColor="#1f2937"
              maskColor="rgba(13, 17, 23, 0.55)"
            />
          ) : null}
          <Panel position="top-left">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/95 px-3 py-2 shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={fitGraph}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Fit
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirection((prev) => (prev === 'TB' ? 'LR' : 'TB'));
                  requestAnimationFrame(() => fitGraph());
                }}
                aria-label="Toggle graph direction"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
              >
                <Rows3 className="w-3.5 h-3.5" />
                {direction === 'TB' ? 'Top-down' : 'Left-right'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFocusActiveOverride(!focusActive);
                  requestAnimationFrame(() => fitGraph());
                }}
                aria-pressed={focusActive}
                className={[
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                  focusActive
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-border text-text-secondary hover:text-text-primary hover:border-accent',
                ].join(' ')}
              >
                <Target className="w-3.5 h-3.5" />
                Focus active
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompleted((prev) => !prev);
                  requestAnimationFrame(() => fitGraph());
                }}
                aria-pressed={!showCompleted}
                className={[
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                  showCompleted
                    ? 'border-border text-text-secondary hover:text-text-primary hover:border-accent'
                    : 'border-accent text-accent bg-accent/10',
                ].join(' ')}
              >
                {showCompleted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {showCompleted ? 'Hide completed' : 'Show completed'}
              </button>
            </div>
          </Panel>

          {focusedSession ? (
            <Panel position="bottom-left">
              <div className="w-[300px] rounded-lg border border-border bg-surface/95 px-4 py-3 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wide text-text-secondary">
                      {focusedSession.nodeKind === 'phase' ? 'Agent phase' : 'Agent session'}
                    </div>
                    <div className="text-sm font-semibold text-text-primary truncate">
                      {focusedSession.agent}
                    </div>
                    <div className="text-xs text-text-secondary truncate">
                      {focusedSession.title || 'Untitled session'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFocusedNodeId(null)}
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary">
                      {focusedSession.status ?? 'completed'}
                    </span>
                    <span className="text-text-secondary">
                      updated {formatRelativeTime(focusedSession.updatedAt)}
                    </span>
                  </div>
                  <div className="text-text-secondary">{focusedSession.currentAction || 'No active task'}</div>
                  <div className="flex items-center justify-between gap-3 text-text-secondary">
                    <span className="truncate">
                      {focusedSession.providerID && focusedSession.modelID
                        ? `${focusedSession.providerID}/${focusedSession.modelID}`
                        : 'model unknown'}
                    </span>
                    <span className="shrink-0">
                      {focusedSession.tokens?.toLocaleString() ?? 0} toks
                    </span>
                  </div>
                  {focusedSession.toolCalls?.[0] ? (
                    <div className="rounded-md bg-background/80 px-2 py-1 font-mono text-[11px] text-text-secondary truncate">
                      {focusedSession.toolCalls[0].summary}
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>
          ) : null}
        </ReactFlow>
      </div>
    </GraphShell>
  );
};

export default GraphView;
