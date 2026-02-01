import React from 'react';
import { Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import type { ToolCall } from '../../../shared/types';

interface ToolCallsProps {
  toolCalls: ToolCall[];
  isExpanded: boolean;
  onToggle: () => void;
}

export const ToolCalls: React.FC<ToolCallsProps> = ({ toolCalls, isExpanded, onToggle }) => {
  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  const getStateStyles = (state: ToolCall['state']) => {
    switch (state) {
      case 'pending':
        return 'bg-warning/20 text-warning';
      case 'complete':
        return 'bg-success/20 text-success';
      case 'error':
        return 'bg-error/20 text-error';
      default:
        return 'bg-text-secondary/20 text-text-secondary';
    }
  };

  return (
    <div 
      className="w-full bg-surface border-t border-border shadow-sm fixed bottom-0 left-0 right-0 z-50 max-h-[50vh] flex flex-col"
      data-testid="tool-calls-panel"
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-accent" />
          <h2 className="font-medium text-text-primary">Tool Calls</h2>
          <span className="text-xs text-text-secondary bg-background/50 px-2 py-0.5 rounded-full">
            {toolCalls.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-text-secondary" />
        ) : (
          <ChevronUp className="w-5 h-5 text-text-secondary" />
        )}
      </button>

      {isExpanded && (
        <div className="overflow-y-auto flex-1 bg-surface/50">
          {toolCalls.length === 0 ? (
            <div className="p-8 text-center text-text-secondary text-sm">
              No tool calls recorded yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {toolCalls.slice().reverse().map((call) => (
                <div key={call.id} className="p-2 px-4 hover:bg-white/5 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className={`text-xs px-2 py-1 rounded font-medium capitalize ${getStateStyles(call.state)}`}>
                      {call.state}
                    </span>
                    <span className="font-mono text-sm text-text-primary truncate">
                      {call.name}
                    </span>
                  </div>
                  <span className="text-xs text-text-secondary shrink-0 font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                    {getRelativeTime(call.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
