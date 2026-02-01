import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Activity, Check, Loader2, Circle, ChevronRight, ChevronDown } from 'lucide-react';
import type { ActivitySession, SessionStatus } from '@shared/types';
import { getAgentColor } from '../utils/agentColors';
import { EmptyState } from './EmptyState';
import { LoadingSkeleton } from './LoadingSkeleton';
import { ToolCallRow } from './ToolCallRow';

interface LiveActivityProps {
  sessions: ActivitySession[];
  loading: boolean;
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString();
}

interface SessionNode {
  session: ActivitySession;
  children: SessionNode[];
}

function buildSessionTree(sessions: ActivitySession[]): SessionNode[] {
  const nodeMap = new Map<string, SessionNode>();
  const roots: SessionNode[] = [];

  sessions.forEach(session => {
    nodeMap.set(session.id, { session, children: [] });
  });

  sessions.forEach(session => {
    const node = nodeMap.get(session.id)!;
    if (session.parentID && nodeMap.has(session.parentID)) {
      const parent = nodeMap.get(session.parentID)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: SessionNode[]) => {
    nodes.sort((a, b) => {
      const timeA = new Date(a.session.updatedAt).getTime();
      const timeB = new Date(b.session.updatedAt).getTime();
      return timeB - timeA; // Most recent activity first
    });
    nodes.forEach(node => {
      sortNodes(node.children);
    });
  };

  sortNodes(roots);
  return roots;
}

const StatusIndicator: React.FC<{ status: SessionStatus }> = ({ status }) => {
  switch (status) {
    case 'working':
      return (
        <span className="flex items-center justify-center w-4 h-4" data-testid="status-working">
          <Loader2 className="w-3 h-3 text-accent animate-spin" />
        </span>
      );
    case 'idle':
      return (
        <span className="flex items-center justify-center w-4 h-4" data-testid="status-idle">
          <Circle className="w-3 h-3 text-success animate-pulse" />
        </span>
      );
    case 'waiting':
      return (
        <span className="flex items-center justify-center w-4 h-4" data-testid="status-waiting">
          <Circle className="w-3 h-3 text-gray-500" />
        </span>
      );
    case 'completed':
    default:
      return (
        <span className="flex items-center justify-center w-4 h-4" data-testid="status-completed">
          <Check className="w-3 h-3 text-green-500" />
        </span>
      );
  }
};

const SessionRow: React.FC<{ node: SessionNode; depth: number; isLast: boolean }> = ({ node, depth, isLast }) => {
  const { session, children } = node;
  const agentColor = getAgentColor(session.agent);
  const status: SessionStatus = session.status || 'completed';
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);
  
  let currentActionText = session.currentAction;
  if (!currentActionText) {
    if (session.workingChildCount && session.workingChildCount > 0) {
      currentActionText = `waiting on ${session.workingChildCount} agents`;
    } else if (status === 'working') {
      currentActionText = 'Thinking...';
    } else if (status === 'waiting') {
      currentActionText = 'Waiting for input';
    }
  }

  const hasToolCalls = session.toolCalls && session.toolCalls.length > 0;
  // DEBUG LOG
  // if (hasToolCalls) console.log('Session', session.id, 'showAllTools:', showAllTools, 'total:', session.toolCalls?.length);
  
  const visibleToolCalls = hasToolCalls 
    ? (showAllTools ? session.toolCalls : session.toolCalls?.slice(0, 5)) 
    : [];
  const remainingTools = (session.toolCalls?.length || 0) - (visibleToolCalls?.length || 0);
  
  return (
    <div className="flex flex-col">
      <div 
        className={`flex items-start gap-2 py-1.5 hover:bg-white/[0.02] rounded px-2 -mx-2 ${hasToolCalls ? 'cursor-pointer' : ''}`}
        style={{ marginLeft: `${depth * 20}px` }}
        onClick={() => hasToolCalls && setToolsExpanded(!toolsExpanded)}
        data-testid={`session-row-${session.id}`}
      >
        {depth > 0 && (
          <div className="flex items-center text-border select-none shrink-0 mt-0.5">
            <span className="text-xs">{isLast ? '└' : '├'}</span>
            <span className="text-xs">─</span>
          </div>
        )}
        
        {hasToolCalls && (
          <div className="mt-0.5 text-gray-500" data-testid={`session-row-expand-${session.id}`}>
            {toolsExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </div>
        )}
        {!hasToolCalls && <div className="w-3" />}
        
        <StatusIndicator status={status} />
        
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span 
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-white text-xs font-medium shrink-0"
              style={{ backgroundColor: agentColor }}
            >
              {session.agent}
            </span>
            
            {currentActionText && (
              <span className="text-text-secondary text-xs truncate max-w-[200px]" data-testid="current-action">
                {currentActionText}
              </span>
            )}
            
            {(session.providerID || session.modelID) && (
              <span className="text-gray-500 text-xs truncate">
                {session.providerID}/{session.modelID}
              </span>
            )}
            
            <span className="text-gray-600 text-xs">
              {formatRelativeTime(session.updatedAt)}
            </span>
            
            {session.tokens !== undefined && (
              <span className="text-gray-500 text-xs ml-auto shrink-0">
                {session.tokens.toLocaleString()} tokens
              </span>
            )}
          </div>
        </div>
      </div>

      {toolsExpanded && hasToolCalls && (
        <div 
          className="flex flex-col border-l border-white/[0.1] ml-[calc(20px+6px)] pl-2 my-1 gap-1"
          style={{ marginLeft: `${(depth * 20) + 20}px` }}
          data-testid={`tool-calls-expanded-${session.id}`}
        >
          <div data-testid={`tool-calls-list-${session.id}`}>
             {visibleToolCalls?.map(toolCall => (
                <ToolCallRow key={toolCall.id} toolCall={toolCall} />
             ))}
             {remainingTools > 0 && (
               <div 
                 className="text-xs text-accent hover:underline cursor-pointer px-2 py-1"
                 onClick={(e) => {
                   e.stopPropagation();
                   setShowAllTools(true);
                 }}
               >
                 Show {remainingTools} more...
               </div>
             )}
          </div>
        </div>
      )}

      {children.map((child, idx) => (
        <SessionRow 
          key={child.session.id} 
          node={child} 
          depth={depth + 1} 
          isLast={idx === children.length - 1}
        />
      ))}
    </div>
  );
};

export const LiveActivity: React.FC<LiveActivityProps> = ({ sessions, loading }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const newestSessionId = sessions[0]?.id;
  useEffect(() => {
    if (containerRef.current && newestSessionId) {
      containerRef.current.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
      });
    }
  }, [newestSessionId]);

  const tree = useMemo(() => buildSessionTree(sessions), [sessions]);

  if (loading && sessions.length === 0) {
    return (
      <div className="h-full w-full bg-surface overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Live Activity</h3>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="h-full w-full bg-surface overflow-hidden flex flex-col">
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
    <div className="h-full w-full bg-surface overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm">Live Activity</h3>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-xs text-text-secondary">Connected</span>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {tree.map((node, idx) => (
          <SessionRow key={node.session.id} node={node} depth={0} isLast={idx === tree.length - 1} />
        ))}
      </div>
    </div>
  );
};
