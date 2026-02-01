import React, { useEffect, useRef, useMemo } from 'react';
import { Activity, Check, Loader2 } from 'lucide-react';
import type { ActivitySession } from '@shared/types';
import { getAgentColor } from '../utils/agentColors';
import { EmptyState } from './EmptyState';
import { LoadingSkeleton } from './LoadingSkeleton';

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

  const sortNodes = (nodes: SessionNode[], isRoot: boolean = false) => {
    nodes.sort((a, b) => {
      const timeA = new Date(a.session.createdAt).getTime();
      const timeB = new Date(b.session.createdAt).getTime();
      return isRoot ? timeB - timeA : timeA - timeB;
    });
    nodes.forEach(node => {
      sortNodes(node.children, false);
    });
  };

  sortNodes(roots, true);
  return roots;
}

const StatusIndicator: React.FC<{ isRunning: boolean }> = ({ isRunning }) => {
  if (isRunning) {
    return (
      <span className="flex items-center justify-center w-4 h-4">
        <Loader2 className="w-3 h-3 text-accent animate-spin" />
      </span>
    );
  }
  return (
    <span className="flex items-center justify-center w-4 h-4">
      <Check className="w-3 h-3 text-green-500" />
    </span>
  );
};

const SessionRow: React.FC<{ node: SessionNode; depth: number; isLast: boolean }> = ({ node, depth, isLast }) => {
  const { session, children } = node;
  const agentColor = getAgentColor(session.agent);
  const isRunning = session.tokens === undefined;
  
  return (
    <div className="flex flex-col">
      <div 
        className="flex items-start gap-2 py-1.5 hover:bg-white/[0.02] rounded px-2 -mx-2"
        style={{ marginLeft: `${depth * 20}px` }}
      >
        {depth > 0 && (
          <div className="flex items-center text-border select-none shrink-0 mt-0.5">
            <span className="text-xs">{isLast ? '└' : '├'}</span>
            <span className="text-xs">─</span>
          </div>
        )}
        
        <StatusIndicator isRunning={isRunning} />
        
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span 
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-white text-xs font-medium shrink-0"
              style={{ backgroundColor: agentColor }}
            >
              {session.agent}
            </span>
            
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
