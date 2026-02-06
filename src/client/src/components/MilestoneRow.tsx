import { ArrowDownRight, Check, X, AlertCircle } from 'lucide-react';
import type { MilestoneEntry } from '@shared/types';
import { getAgentColor } from '../utils/agentColors';
import { formatTime } from '../utils/formatters';

interface MilestoneRowProps {
  entry: MilestoneEntry;
}

export function MilestoneRow({ entry }: MilestoneRowProps) {
  const { item } = entry;
  
  if (item.type === 'tool-call' && item.state === 'error') {
    return (
      <div className="flex items-center gap-3 p-3 bg-red-500/5 border-b border-border/50 border-l-2 border-l-red-500" data-testid="milestone-error">
        <span className="text-xs text-gray-600 font-mono shrink-0 w-16">
          {formatTime(item.timestamp)}
        </span>
        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-red-200 font-medium">Tool Error: {item.toolName}</div>
          <div className="text-xs text-red-300/70 font-mono truncate">{item.error || 'Unknown error'}</div>
        </div>
      </div>
    );
  }

  if (item.type === 'agent-spawn') {
    return (
      <div className="flex items-center gap-3 p-3 bg-surface/50 border-b border-border/50" data-testid="milestone-spawn">
        <span className="text-xs text-gray-600 font-mono shrink-0 w-16">
          {formatTime(item.timestamp)}
        </span>
        <ArrowDownRight className="w-4 h-4 text-accent shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          <span className="text-gray-400">Spawned </span>
          <span style={{ color: getAgentColor(item.spawnedAgentName) }} className="font-medium">
            {item.spawnedAgentName}
          </span>
          <span className="text-gray-600 text-xs ml-2">from {item.agentName}</span>
        </div>
      </div>
    );
  }

  if (item.type === 'agent-complete') {
    return (
      <div className="flex items-center gap-3 p-3 bg-surface/50 border-b border-border/50" data-testid="milestone-complete">
        <span className="text-xs text-gray-600 font-mono shrink-0 w-16">
          {formatTime(item.timestamp)}
        </span>
        {item.status === 'completed' ? (
          <Check className="w-4 h-4 text-green-500 shrink-0" />
        ) : (
          <X className="w-4 h-4 text-red-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0 text-sm">
          <span style={{ color: getAgentColor(item.agentName) }} className="font-medium">
            {item.agentName}
          </span>
          <span className="text-gray-400 ml-2">
            completed ({item.status})
          </span>
          {item.durationMs != null && (
            <span className="ml-2 text-xs text-gray-600 font-mono">
              {Math.round(item.durationMs / 1000)}s
            </span>
          )}
        </div>
      </div>
    );
  }

  return null;
}
