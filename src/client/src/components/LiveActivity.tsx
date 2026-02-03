import React, { useEffect, useRef, useMemo, memo, useState } from 'react';
import { Activity, Check, Loader2, Circle } from 'lucide-react';
import type { ActivitySession, SessionStatus, ToolCallSummary } from '@shared/types';
import { EmptyState } from './EmptyState';
import { LoadingSkeleton } from './LoadingSkeleton';
import { AgentBadge } from './AgentBadge';

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
  
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
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

const StatusIndicator = memo<{ status: SessionStatus }>(function StatusIndicator({ status }) {
   switch (status) {
      case 'working':
        return (
          <span 
            className="flex items-center justify-center w-4 h-4 rounded-full animate-badge-glow" 
            style={{ '--badge-color': 'rgba(88, 166, 255, 0.5)' } as React.CSSProperties}
            data-testid="status-working"
          >
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
});

function extractPrimaryArg(input: object, maxLength: number = 60): string | null {
  const typedInput = input as { filePath?: string; command?: string; pattern?: string; query?: string; url?: string };
  const keys = ['filePath', 'command', 'pattern', 'query', 'url'];
  for (const key of keys) {
    if (typedInput[key as keyof typeof typedInput]) {
      const val = String(typedInput[key as keyof typeof typedInput]);
      return val.length > maxLength ? '...' + val.slice(-maxLength) : val;
    }
  }
  return null;
}

function getFullToolDisplayText(toolCalls?: ToolCallSummary[]): { toolName: string; toolArg: string | null } | null {
  if (!toolCalls || toolCalls.length === 0) return null;
  const latest = toolCalls[0]; // [0] is most recent (sorted desc)
  const toolName = latest.name.replace('mcp_', ''); // Clean up prefix
  const toolArg = extractPrimaryArg(latest.input, 60);
  return { toolName, toolArg };
}

const SessionRow = memo<{ node: SessionNode; depth: number; isLast: boolean }>(function SessionRow({ node, depth, isLast }) {
   const { session, children } = node;
   const status: SessionStatus = session.status || 'completed';
   
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

   const truncatedAction = currentActionText && currentActionText.length > 80 
     ? currentActionText.slice(0, 77) + '...' 
     : currentActionText;

   const toolInfo = getFullToolDisplayText(session.toolCalls);
   
   return (
     <div className="flex flex-col">
       <div 
         className={`flex items-center gap-2 py-1.5 hover:bg-white/[0.02] rounded px-2 -mx-2 ${status === 'completed' ? 'opacity-60' : ''}`}
         style={{ marginLeft: `${depth * 20}px` }}
         data-testid={`session-row-${session.id}`}
       >
         {depth > 0 && (
           <div className="flex items-center text-border select-none shrink-0">
             <span className="text-xs">{isLast ? '└' : '├'}</span>
             <span className="text-xs">─</span>
           </div>
         )}
         
         <StatusIndicator status={status} />
         
         <AgentBadge agent={session.agent} status={status} />
         
         <div className="flex-1 min-w-0 flex flex-col gap-0.5">
           <span className="text-text-secondary text-xs truncate" data-testid="current-action">
             {truncatedAction}
           </span>
           
           {toolInfo && (
             <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono" data-testid="tool-info">
               <span className="text-gray-400">{toolInfo.toolName}</span>
               {toolInfo.toolArg && (
                 <span className="text-gray-500 truncate">{toolInfo.toolArg}</span>
               )}
             </div>
           )}
         </div>

         <div className="flex flex-col items-end shrink-0 text-xs">
           {(session.providerID || session.modelID) && (
             <span className="text-gray-500 truncate max-w-[180px]">
               {session.providerID}/{session.modelID}
             </span>
           )}
           <div className="flex items-center gap-1 text-gray-600">
             <span>{formatRelativeTime(session.updatedAt)}</span>
             {session.tokens !== undefined && (
               <>
                 <span>·</span>
                 <span>{session.tokens.toLocaleString()} tokens</span>
               </>
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
});

export const LiveActivity: React.FC<LiveActivityProps> = ({ sessions, loading }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const isWorking = useMemo(() => sessions.some(s => s.status === 'working'), [sessions]);

  useEffect(() => {
    if (sessions.length > 0) {
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [sessions]);

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
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Live Activity</h3>
          {isWorking && (
            <span className="relative flex h-2 w-2" title="Activity in progress">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 ${isUpdating ? 'animate-ping' : ''}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 transition-all duration-300 ${isUpdating ? 'bg-green-400 scale-125' : 'bg-green-500'}`}></span>
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
