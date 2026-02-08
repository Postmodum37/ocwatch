import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { motion } from 'motion/react';
import { 
  Check, 
  Loader2, 
  Circle, 
  Clock, 
  Sparkles, 
  FileEdit, 
  Terminal, 
  MessageCircleQuestion 
} from 'lucide-react';
import type { ActivitySession, SessionStatus, SessionActivityType } from '@shared/types';
import { formatRelativeTime } from '@shared/utils/formatTime';
import { AgentBadge } from '../AgentBadge';
import { getFullToolDisplayText } from './nodeHelpers';

const StatusIndicator = memo<{ status: SessionStatus }>(function StatusIndicator({ status }) {
  switch (status) {
    case 'working':
      return (
        <span 
          className="flex items-center justify-center w-4 h-4 rounded-full animate-badge-glow" 
          style={{ '--badge-color': 'rgba(88, 166, 255, 0.5)' } as React.CSSProperties}
          role="img"
          aria-label="Working"
        >
          <Loader2 className="w-3 h-3 text-accent animate-spin" />
        </span>
      );
    case 'idle':
      return (
        <span className="flex items-center justify-center w-4 h-4" role="img" aria-label="Idle">
          <Circle className="w-3 h-3 text-success animate-pulse" />
        </span>
      );
    case 'waiting':
      return (
        <span className="flex items-center justify-center w-4 h-4" role="img" aria-label="Waiting">
          <Clock className="w-3 h-3 text-amber-500" />
        </span>
      );
    case 'completed':
    default:
      return (
        <span className="flex items-center justify-center w-4 h-4" role="img" aria-label="Completed">
          <Check className="w-3 h-3 text-green-500" />
        </span>
      );
  }
});

const ActivityTypeIndicator = memo<{ activityType?: SessionActivityType; pendingCount?: number; patchCount?: number }>(
  function ActivityTypeIndicator({ activityType, pendingCount, patchCount }) {
    if (!activityType || activityType === 'idle') return null;
    
    switch (activityType) {
      case 'reasoning':
        return (
          <span className="flex items-center gap-1 text-purple-400" title="Reasoning">
            <Sparkles className="w-3 h-3" />
          </span>
        );
      case 'patch':
        return (
          <span className="flex items-center gap-1 text-orange-400" title={`Writing ${patchCount} files`}>
            <FileEdit className="w-3 h-3" />
            {patchCount && patchCount > 1 && <span className="text-[10px]">{patchCount}</span>}
          </span>
        );
      case 'tool':
        return (
          <span className="flex items-center gap-1 text-blue-400" title={`Running ${pendingCount} tools`}>
            <Terminal className="w-3 h-3" />
            {pendingCount && pendingCount > 1 && <span className="text-[10px]">{pendingCount}</span>}
          </span>
        );
      case 'waiting-tools':
        return (
          <span className="flex items-center gap-1 text-amber-400" title="Waiting for tools">
            <Clock className="w-3 h-3" />
          </span>
        );
      case 'waiting-user':
        return (
          <span className="flex items-center text-warning" title="Waiting for your input">
            <MessageCircleQuestion className="w-3.5 h-3.5" />
          </span>
        );
      default:
        return null;
    }
  }
);

export const AgentNode = memo(function AgentNode({ data, selected }: NodeProps) {
  const session = data as unknown as ActivitySession;
  
  // Runtime guard for data contract
  if (!session?.id || !session?.agent) {
    return (
      <div className="flex items-center justify-center w-[250px] h-[60px] rounded-md border border-error/50 bg-surface text-error text-xs p-2">
        Invalid node data
      </div>
    );
  }

  const status: SessionStatus = session.status || 'completed';
  const isCompleted = status === 'completed';
  
  let currentActionText = session.currentAction;
  if (session.activityType === 'waiting-user' && (!currentActionText || currentActionText === 'question')) {
    currentActionText = 'Waiting for your response';
  } else if (!currentActionText) {
    if (session.workingChildCount && session.workingChildCount > 0) {
      currentActionText = `Waiting on ${session.workingChildCount} agent${session.workingChildCount > 1 ? 's' : ''}`;
    } else if (isCompleted && session.parentID && session.title) {
      currentActionText = session.title;
    }
  }

  const toolInfo = getFullToolDisplayText(session.toolCalls);

  // Animation variants for entering and state changes
  const variants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { 
      opacity: isCompleted ? 0.3 : 1, 
      scale: 1,
      transition: { duration: 0.3 }
    },
    hover: isCompleted ? { opacity: 0.8 } : {}
  };

  return (
    <motion.div 
      initial="initial"
      animate="animate"
      whileHover="hover"
      variants={variants}
      className={`
        relative flex flex-col w-[250px] rounded-md border 
        bg-surface transition-colors duration-200
        ${selected ? 'border-accent ring-1 ring-accent shadow-[0_0_15px_rgba(88,166,255,0.15)]' : 'border-border'}
        ${session.activityType === 'waiting-user' ? 'border-l-2 border-l-warning' : ''}
        ${status === 'working' ? 'animate-node-pulse' : ''}
      `}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-border !w-2 !h-2" 
      />

      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-black/20">
        <div className="flex items-center gap-2">
          <AgentBadge agent={session.agent} status={status} />
          <StatusIndicator status={status} />
        </div>
        <ActivityTypeIndicator 
          activityType={session.activityType}
          pendingCount={session.pendingToolCount}
          patchCount={session.patchFilesCount}
        />
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div className="text-xs text-text-secondary line-clamp-2 min-h-[1.5em]" title={currentActionText || ''}>
          {currentActionText || <span className="italic opacity-50">No activity</span>}
        </div>

        {toolInfo && !session.activityType?.startsWith('waiting') && (
          <div className="flex items-center gap-1.5 text-xs text-text-primary font-mono bg-black/30 rounded px-1.5 py-1">
            <span className="text-gray-400 shrink-0">{toolInfo.toolName}</span>
            {toolInfo.toolArg && (
              <span className="text-gray-500 truncate" title={toolInfo.toolArg}>
                {toolInfo.toolArg}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border/50 flex items-center justify-between text-[10px] text-text-secondary bg-black/10">
        <div className="flex flex-col truncate max-w-[120px]">
          {(session.providerID || session.modelID) && (
            <span className="truncate" title={`${session.providerID}/${session.modelID}`}>
              {session.providerID}/{session.modelID}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span>{formatRelativeTime(session.updatedAt)}</span>
          {session.tokens !== undefined && (
            <span>{session.tokens.toLocaleString()} toks</span>
          )}
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-border !w-2 !h-2" 
      />
    </motion.div>
  );
});
