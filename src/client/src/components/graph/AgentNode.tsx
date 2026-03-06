import React, { memo } from 'react';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import {
  Check,
  ChevronDown,
  Circle,
  Clock,
  FileEdit,
  Loader2,
  MessageCircleQuestion,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type { SessionActivityType, SessionStatus } from '@shared/types';
import { formatRelativeTime } from '@shared/utils/formatTime';
import { AgentBadge } from '../AgentBadge';
import { getFullToolDisplayText } from './nodeHelpers';
import type { GraphNodeData } from './types';

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
  },
);

export const AgentNode = memo(function AgentNode({
  data,
}: NodeProps<Node<GraphNodeData>>) {
  const graphNodeData = data as GraphNodeData;
  const session = graphNodeData.session;

  if (!session?.id || !session?.agent) {
    return (
      <div className="flex items-center justify-center w-[320px] min-h-[60px] rounded-md border border-error/50 bg-surface text-error text-xs p-2">
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

  return (
    <div
      className={[
        'relative flex flex-col w-[320px] rounded-md border bg-surface transition-[opacity,border-color,box-shadow,transform] duration-200',
        graphNodeData.isFocused
          ? 'border-accent ring-1 ring-accent shadow-[0_0_18px_rgba(88,166,255,0.18)]'
          : 'border-border',
        graphNodeData.isDimmed ? 'opacity-35 scale-[0.98]' : (isCompleted ? 'opacity-80' : 'opacity-100'),
        session.activityType === 'waiting-user' ? 'border-l-2 border-l-warning' : '',
        status === 'working' && !graphNodeData.isDimmed ? 'animate-node-pulse' : '',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />

      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-black/20">
        <div className="flex items-center gap-2 min-w-0">
          <AgentBadge agent={session.agent} status={status} />
          {session.nodeKind === 'phase' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border border-border text-text-secondary">
              Phase
            </span>
          )}
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

        {graphNodeData.collapsedDescendantCount > 0 && (
          <button
            type="button"
            className="nodrag nopan inline-flex items-center gap-1.5 w-fit px-2 py-1 rounded-full border border-border bg-background/80 text-[11px] text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              graphNodeData.onToggleCollapse(session.id);
            }}
          >
            <ChevronDown className="w-3 h-3" />
            <span>+{graphNodeData.collapsedDescendantCount} completed</span>
          </button>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border/50 flex items-center justify-between text-[10px] text-text-secondary bg-black/10">
        <div className="flex flex-col truncate">
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

      <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2" />
    </div>
  );
});
