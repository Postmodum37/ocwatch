import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import type { BurstEntry } from '@shared/types';
import { ActivityRow } from './ActivityRow';
import { getAgentColor } from '../utils/agentColors';
import { formatTime } from '../utils/formatters';

interface BurstRowProps {
  burst: BurstEntry;
}

export function BurstRow({ burst }: BurstRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const agentColor = getAgentColor(burst.agentName);

  const breakdown = Object.entries(burst.toolBreakdown)
    .map(([tool, count]) => `${tool} ×${count}`)
    .join(', ');

  const hasError = burst.errorCount > 0;
  const isPending = burst.pendingCount > 0;

  return (
    <div className="flex flex-col border-b border-border/50" data-testid="burst-row">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex items-center gap-3 p-2 hover:bg-white/[0.02] transition-colors text-left cursor-pointer group w-full"
      >
        <span className="text-xs text-gray-600 font-mono shrink-0 w-16">
          {formatTime(burst.firstTimestamp)}
        </span>

        <div 
          className="w-1.5 h-1.5 rounded-full shrink-0" 
          style={{ backgroundColor: agentColor }} 
        />

        <div className="flex-1 min-w-0 text-sm flex items-center gap-2">
          <span className="font-mono text-xs opacity-90" style={{ color: agentColor }}>
            {burst.agentName}
          </span>
          <span className="text-text-secondary text-xs truncate">
            {breakdown}
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          {burst.durationMs > 0 && (
             <span className="text-xs text-gray-600 font-mono">
               {Math.round(burst.durationMs / 1000)}s
             </span>
          )}
          
          {hasError && <AlertCircle className="w-3 h-3 text-red-500" />}
          {isPending && <Loader2 className="w-3 h-3 animate-spin text-accent" />}
          
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-500" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-500" />
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
            className="overflow-hidden bg-white/[0.01]"
          >
             <div className="pl-4 border-l border-border/30 ml-4 mb-2">
               {burst.items.map(item => (
                 <ActivityRow key={item.id} item={item} />
               ))}
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
