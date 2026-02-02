import React, { useState } from 'react';
import { 
  Terminal, 
  FileText, 
  FileEdit, 
  Search, 
  Globe, 
  ArrowDownRight, 
  Check, 
  X, 
  ChevronRight, 
  ChevronDown,
  Loader2,
  Circle
} from 'lucide-react';
import type { ActivityItem } from '@shared/types';
import { getAgentColor } from '../utils/agentColors';

interface ActivityRowProps {
  item: ActivityItem;
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getToolIcon(toolName: string) {
  const lower = toolName.toLowerCase();
  if (lower.includes('read')) return FileText;
  if (lower.includes('write') || lower.includes('edit') || lower.includes('replace')) return FileEdit;
  if (lower.includes('search') || lower.includes('grep') || lower.includes('glob')) return Search;
  if (lower.includes('fetch') || lower.includes('web')) return Globe;
  return Terminal;
}

export const ActivityRow: React.FC<ActivityRowProps> = ({ item }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const agentColor = getAgentColor(item.agentName);
  
  const renderIcon = () => {
    switch (item.type) {
      case 'tool-call': {
        const Icon = getToolIcon(item.toolName);
        return <Icon className="w-4 h-4 text-gray-400" />;
      }
      case 'agent-spawn':
        return <ArrowDownRight className="w-4 h-4 text-accent" />;
      case 'agent-complete':
        return item.status === 'completed' 
          ? <Check className="w-4 h-4 text-green-500" />
          : <X className="w-4 h-4 text-red-500" />;
    }
  };

  const renderStatus = () => {
    if (item.type === 'tool-call') {
      switch (item.state) {
        case 'pending': return <Loader2 className="w-3 h-3 animate-spin text-accent" />;
        case 'error': return <X className="w-3 h-3 text-red-500" />;
        case 'complete': return <Check className="w-3 h-3 text-green-500" />;
        default: return <Circle className="w-3 h-3 text-gray-600" />;
      }
    }
    return null;
  };

  const renderSummary = () => {
    switch (item.type) {
      case 'tool-call':
        return (
          <span className="truncate text-text-primary">
            <span className="font-mono text-accent/80 mr-2">{item.toolName}</span>
            <span className="text-gray-400">{item.summary || JSON.stringify(item.input).slice(0, 50)}</span>
          </span>
        );
      case 'agent-spawn':
        return (
          <span className="text-gray-400">
            Spawned <span style={{ color: getAgentColor(item.spawnedAgentName) }}>{item.spawnedAgentName}</span>
          </span>
        );
      case 'agent-complete':
        return (
          <span className="text-gray-400">
            Completed task ({item.status})
            {item.durationMs && <span className="ml-2 text-xs opacity-60">{Math.round(item.durationMs / 1000)}s</span>}
          </span>
        );
    }
  };

  const renderDetails = () => {
    if (item.type === 'tool-call') {
      return (
        <div className="mt-2 pl-6 space-y-2">
          {item.input && (
            <div className="bg-surface/50 rounded p-2 text-xs font-mono overflow-x-auto text-gray-300">
              <div className="text-gray-500 mb-1 uppercase text-[10px] tracking-wider">Input</div>
              <pre>{JSON.stringify(item.input, null, 2)}</pre>
            </div>
          )}
          {item.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-xs font-mono text-red-400">
              <div className="uppercase text-[10px] tracking-wider mb-1">Error</div>
              {item.error}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const isExpandable = item.type === 'tool-call' && (item.input || item.error);

  return (
    <div className="flex flex-col border-b border-border/50 animate-slide-in-from-top">
      <div 
        role={isExpandable ? "button" : undefined}
        tabIndex={isExpandable ? 0 : undefined}
        className={`flex items-center gap-3 p-2 hover:bg-white/[0.02] transition-colors ${isExpandable ? 'cursor-pointer' : ''}`}
        onClick={() => isExpandable && setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (isExpandable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <span className="text-xs text-gray-600 font-mono shrink-0 w-16">
          {formatTime(item.timestamp)}
        </span>
        
        <div 
          className="w-1.5 h-1.5 rounded-full shrink-0" 
          style={{ backgroundColor: agentColor }} 
          title={item.agentName}
        />
        
        <div className="shrink-0">
          {renderIcon()}
        </div>

        <div className="flex-1 min-w-0 text-sm flex items-center">
          {renderSummary()}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {renderStatus()}
          {isExpandable && (
            isExpanded ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="pb-2 pr-2">
          {renderDetails()}
        </div>
      )}
    </div>
  );
};
