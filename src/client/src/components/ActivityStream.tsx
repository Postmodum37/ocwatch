import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { AnimatePresence } from 'motion/react';
import { Activity, ChevronDown, ChevronUp, ArrowDownRight, Check, X } from 'lucide-react';
import type { AgentSpawnActivity, AgentCompleteActivity } from '@shared/types';
import { getAgentColor } from '../utils/agentColors';
import { formatTime } from '../utils/formatters';

interface ActivityStreamProps {
  entries: (AgentSpawnActivity | AgentCompleteActivity)[];
}

export const ActivityStream = memo<ActivityStreamProps>(function ActivityStream({ entries }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const seenIdsRef = useRef<Set<string> | null>(null);
  if (seenIdsRef.current === null) {
    seenIdsRef.current = new Set(entries.map(e => e.id));
  }
  const [newItemsCount, setNewItemsCount] = useState(0);

  useEffect(() => {
    const seen = seenIdsRef.current!;
    let newCount = 0;
    for (const entry of entries) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        newCount++;
      }
    }

    if (seen.size > 2000) {
      seenIdsRef.current = new Set(entries.map(e => e.id));
    }

    if (newCount > 0) {
      if (isExpanded) {
        setNewItemsCount(0);
      } else {
        setNewItemsCount(prev => prev + newCount);
      }

      if (autoScroll && scrollRef.current) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        });
      }
    }
  }, [entries, isExpanded, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 50;
    setAutoScroll(isAtBottom);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  const handleToggle = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    if (next) {
      setNewItemsCount(0);
    }
  };

  const agentCount = useMemo(() => {
    const agents = new Set<string>();
    entries.forEach(e => {
      if (e.type === 'agent-spawn') {
        agents.add(e.spawnedAgentName);
        agents.add(e.agentName);
      } else {
        agents.add(e.agentName);
      }
    });
    return agents.size;
  }, [entries]);

  return (
    <div className="border-t border-border bg-surface flex flex-col shrink-0 overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="h-10 px-4 flex items-center justify-between w-full hover:bg-white/[0.02] transition-colors"
        aria-expanded={isExpanded}
        aria-label="Toggle activity stream"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-text-secondary">
            <Activity className="w-4 h-4" />
            <span className="text-sm font-medium">Activity</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-xs font-mono text-text-secondary">
              {entries.length}
            </span>
            {newItemsCount > 0 && !isExpanded && (
              <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-medium animate-pulse">
                +{newItemsCount} new
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isExpanded && entries.length > 0 && (
            <span className="text-xs text-text-secondary">
              {entries.length} events · {agentCount} agents
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          ) : (
            <ChevronUp className="w-4 h-4 text-text-secondary" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <div className="relative h-48 max-h-[30vh]">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="h-full overflow-y-auto overflow-x-hidden bg-[#0d1117]"
              role="log"
              aria-live="polite"
            >
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-text-secondary opacity-50 p-8 h-full">
                  <Activity className="w-8 h-8 mb-2" />
                  <span className="text-sm">No activity yet</span>
                </div>
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-2 text-sm border-b border-border/30 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="font-mono text-xs text-gray-600 w-16 shrink-0">
                      {formatTime(entry.timestamp)}
                    </span>

                    {entry.type === 'agent-spawn' ? (
                      <>
                        <ArrowDownRight className="w-4 h-4 text-accent shrink-0" />
                        <span className="truncate">
                          <span className="text-text-secondary">Spawned </span>
                          <span style={{ color: getAgentColor(entry.spawnedAgentName) }} className="font-medium">
                            {entry.spawnedAgentName}
                          </span>
                          <span className="text-gray-600 text-xs ml-2">from {entry.agentName}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        {entry.status === 'completed' ? (
                          <Check className="w-4 h-4 text-green-500 shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                        <span className="truncate">
                          <span style={{ color: getAgentColor(entry.agentName) }} className="font-medium">
                            {entry.agentName}
                          </span>
                          <span className="text-text-secondary ml-2">completed</span>
                          {entry.durationMs != null && (
                            <span className="ml-2 text-xs text-gray-600 font-mono">
                              {Math.round(entry.durationMs / 1000)}s
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {!autoScroll && entries.length > 0 && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-4 right-4 p-2 rounded-full bg-accent text-white shadow-lg hover:bg-accent/90 transition-colors z-10"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
