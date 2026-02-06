import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
import type { ActivityItem, ToolInput } from '@shared/types';
import { getAgentColor } from '../utils/agentColors';
import { formatTime } from '../utils/formatters';

interface TypedField {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface ActivityRowProps {
  item: ActivityItem;
}

function getToolIcon(toolName: string) {
  const lower = toolName.toLowerCase();
  if (lower.includes('read')) return FileText;
  if (lower.includes('write') || lower.includes('edit') || lower.includes('replace')) return FileEdit;
  if (lower.includes('search') || lower.includes('grep') || lower.includes('glob')) return Search;
  if (lower.includes('fetch') || lower.includes('web')) return Globe;
  return Terminal;
}

function getTypedFields(toolName: string, input: ToolInput | undefined): TypedField[] {
  if (!input) return [];
  
  const lower = toolName.toLowerCase();
  const fields: TypedField[] = [];

  // Read tools: show filePath prominently
  if (lower.includes('read')) {
    if (input.filePath) {
      fields.push({ label: 'File', value: input.filePath, icon: <FileText className="w-3 h-3" /> });
    }
    return fields;
  }

  // Write/edit tools: show filePath + operation
  if (lower.includes('write') || lower.includes('edit') || lower.includes('replace')) {
    if (input.filePath) {
      fields.push({ label: 'File', value: input.filePath, icon: <FileEdit className="w-3 h-3" /> });
    }
    return fields;
  }

  // Grep/search tools: show pattern + optional path/include
  if (lower.includes('grep') || lower.includes('search')) {
    if (input.pattern) {
      fields.push({ label: 'Pattern', value: input.pattern });
    }
    if ((input as Record<string, unknown>).path) {
      fields.push({ label: 'Path', value: String((input as Record<string, unknown>).path) });
    }
    if ((input as Record<string, unknown>).include) {
      fields.push({ label: 'Include', value: String((input as Record<string, unknown>).include) });
    }
    return fields;
  }

  // Glob tools: show pattern + optional path
  if (lower.includes('glob')) {
    if (input.pattern) {
      fields.push({ label: 'Pattern', value: input.pattern });
    }
    if ((input as Record<string, unknown>).path) {
      fields.push({ label: 'Path', value: String((input as Record<string, unknown>).path) });
    }
    return fields;
  }

  // Bash tools: show command + description
  if (lower.includes('bash')) {
    if (input.command) {
      fields.push({ label: 'Command', value: input.command });
    }
    if ((input as Record<string, unknown>).description) {
      fields.push({ label: 'Description', value: String((input as Record<string, unknown>).description) });
    }
    return fields;
  }

  // Webfetch tools: show url
  if (lower.includes('fetch') || lower.includes('web')) {
    if (input.url) {
      fields.push({ label: 'URL', value: input.url, icon: <Globe className="w-3 h-3" /> });
    }
    return fields;
  }

  // Default: no typed fields
  return [];
}

export const ActivityRow = memo<ActivityRowProps>(function ActivityRow({ item }) {
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
             <span className="text-gray-400">{item.summary || (item.input ? JSON.stringify(item.input).slice(0, 50) : '')}</span>
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
             {item.durationMs != null && <span className="ml-2 text-xs opacity-60">{Math.round(item.durationMs / 1000)}s</span>}
           </span>
         );
     }
   };

    const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);

    const renderDetails = () => {
      if (item.type === 'tool-call') {
        const typedFields = getTypedFields(item.toolName, item.input as ToolInput | undefined);
        const hasTypedFields = typedFields.length > 0;

        return (
          <div className="mt-2 pl-6 space-y-2">
            {hasTypedFields && (
              <div className="space-y-1">
                {typedFields.map((field) => (
                  <div key={field.label} className="flex items-start gap-2 text-xs">
                    {field.icon && <span className="text-gray-500 mt-0.5">{field.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-500 uppercase text-[10px] tracking-wider">{field.label}</div>
                      <div className="text-gray-300 font-mono break-all">{field.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {item.input && (
              <div className="border-t border-border/30 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 transition-colors"
                >
                  {isAdvancedExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span>Advanced</span>
                </button>
                <AnimatePresence>
                  {isAdvancedExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-1"
                    >
                      <div className="bg-surface/50 rounded p-2 text-xs font-mono overflow-x-auto text-gray-300">
                        <pre>{JSON.stringify(item.input, null, 2)}</pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
      <div className="flex flex-col border-b border-border/50">
        <button
          type="button"
          disabled={!isExpandable}
          aria-expanded={isExpandable ? isExpanded : undefined}
          className={`flex items-center gap-3 p-2 hover:bg-white/[0.02] transition-colors text-left ${isExpandable ? 'cursor-pointer' : ''}`}
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
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pb-2 pr-2">
                {renderDetails()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
   );
});
