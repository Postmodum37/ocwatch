import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Check, Loader2, AlertCircle } from 'lucide-react';
import type { ToolCallSummary } from '@shared/types';

interface ToolCallRowProps {
  toolCall: ToolCallSummary;
  depth?: number;
}

function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export const ToolCallRow: React.FC<ToolCallRowProps> = ({ toolCall, depth = 0 }) => {
  const [expanded, setExpanded] = useState(false);

  const StatusIcon = () => {
    switch (toolCall.state) {
      case 'pending':
        return <Loader2 className="w-3 h-3 text-accent animate-spin" data-testid="icon-loader" />;
      case 'complete':
        return <Check className="w-3 h-3 text-green-500" data-testid="icon-check" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" data-testid="icon-alert" />;
      default:
        return null;
    }
  };

  const getStatusTestId = () => {
    switch (toolCall.state) {
      case 'pending': return 'status-pending';
      case 'complete': return 'status-complete';
      case 'error': return 'status-error';
      default: return 'status-unknown';
    }
  };

  return (
    <div 
      className="flex flex-col text-xs"
      style={{ marginLeft: `${depth * 20}px` }}
      data-testid={`tool-call-row-${toolCall.id}`}
    >
      <div 
        className="flex items-start gap-2 py-1 px-2 hover:bg-white/[0.04] rounded cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        data-testid="tool-call-row-expand"
      >
        <div className="mt-0.5 text-gray-500">
          {expanded ? (
            <ChevronDown className="w-3 h-3" data-testid="icon-chevron-down" />
          ) : (
            <ChevronRight className="w-3 h-3" data-testid="icon-chevron-right" />
          )}
        </div>

        <div className="flex items-center justify-center w-4 h-4 mt-0.5" data-testid={getStatusTestId()}>
          <StatusIcon />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-accent">{toolCall.name}</span>
            <span className="text-gray-500" data-testid="tool-call-timestamp">
              {formatRelativeTime(toolCall.timestamp)}
            </span>
          </div>
          <div className="text-text-secondary truncate">
            {toolCall.summary}
          </div>
        </div>
      </div>

      {expanded && (
        <div 
          className="pl-8 pr-2 py-2 text-gray-400 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto"
          data-testid="tool-call-arguments"
        >
          {Object.entries(toolCall.input).map(([key, value]) => (
            <div key={key} className="flex flex-col mb-1">
              <span className="text-gray-500">{key}</span>
              <span className="text-text-secondary break-all">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </span>
            </div>
          ))}
          {Object.keys(toolCall.input).length === 0 && (
            <span className="text-gray-600 italic">No arguments</span>
          )}
        </div>
      )}
    </div>
  );
};
