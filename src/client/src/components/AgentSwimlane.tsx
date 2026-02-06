import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Check, X, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import type { StreamEntry, BurstEntry, MilestoneEntry } from '@shared/types';
import { getAgentColor } from '../utils/agentColors';
import { formatTime } from '../utils/formatters';

interface AgentSwimlaneProps {
  entries: StreamEntry[];
}

function getAgentStatus(entries: StreamEntry[], agentName: string): 'active' | 'completed' | 'error' {
  // Single pass: find the LAST completion milestone for this agent
  let lastCompletion: 'completed' | 'error' | null = null;

  for (const entry of entries) {
    if (entry.type === 'milestone' && entry.item.type === 'agent-complete' && entry.item.agentName === agentName) {
      lastCompletion = entry.item.status === 'completed' ? 'completed' : 'error';
    }
  }

  return lastCompletion ?? 'active';
}

/** Classify agent activity level for flex sizing */
type ActivityBucket = 'high' | 'medium' | 'low';

function getActivityBucket(entryCount: number): ActivityBucket {
  if (entryCount >= 5) return 'high';
  if (entryCount >= 2) return 'medium';
  return 'low';
}

const BUCKET_FLEX: Record<ActivityBucket, string> = {
  high: 'flex-[2_1_16rem]',
  medium: 'flex-[1.4_1_13rem]',
  low: 'flex-[1_1_10rem]',
};

export function AgentSwimlane({ entries }: AgentSwimlaneProps) {
  const [expandedCompact, setExpandedCompact] = useState<Set<string>>(new Set());

  const agentEntries = useMemo(() => {
    const map = new Map<string, StreamEntry[]>();

    entries.forEach(entry => {
      const agent = entry.type === 'burst' ? entry.agentName : entry.item.agentName;
      if (!map.has(agent)) {
        map.set(agent, []);
      }
      map.get(agent)!.push(entry);
    });

    return map;
  }, [entries]);

  // Sort agents: active first, then by entry count DESC, then name
  const agents = useMemo(() => {
    const agentList = Array.from(agentEntries.keys());

    return agentList.sort((a, b) => {
      const statusA = getAgentStatus(entries, a);
      const statusB = getAgentStatus(entries, b);

      // Active agents first
      const activeA = statusA === 'active' ? 0 : 1;
      const activeB = statusB === 'active' ? 0 : 1;
      if (activeA !== activeB) return activeA - activeB;

      // Then by entry count descending
      const countA = agentEntries.get(a)?.length ?? 0;
      const countB = agentEntries.get(b)?.length ?? 0;
      if (countA !== countB) return countB - countA;

      // Tie-break: alphabetical
      return a.localeCompare(b);
    });
  }, [entries, agentEntries]);

  const toggleCompact = (agent: string) => {
    setExpandedCompact(prev => {
      const next = new Set(prev);
      if (next.has(agent)) {
        next.delete(agent);
      } else {
        next.add(agent);
      }
      return next;
    });
  };

  if (agents.length === 0) {
    return (
      <div className="p-8 text-center text-text-secondary text-sm">
        No agents yet
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden bg-[#0d1117] min-h-0">
      <div className="flex gap-3 p-4 min-w-min h-full">
        {agents.map(agent => {
          const agentColor = getAgentColor(agent);
          const status = getAgentStatus(entries, agent);
          const agentEntriesList = agentEntries.get(agent) || [];
          const isCompleted = status === 'completed';
          const hasError = status === 'error';
          const entryCount = agentEntriesList.length;
          const bucket = getActivityBucket(entryCount);
          const isCompactCandidate = entryCount <= 1 && !expandedCompact.has(agent);

          return (
            <motion.div
              key={agent}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              data-testid="swimlane-column"
              className={`flex flex-col shrink-0 rounded-lg border overflow-hidden ${
                isCompactCandidate ? 'w-40' : BUCKET_FLEX[bucket]
              } ${
                isCompleted
                  ? 'border-border/30 bg-surface/30 opacity-60'
                  : hasError
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-border bg-surface/50'
              }`}
            >
              {/* Agent Header */}
              <div
                className={`px-3 py-2 border-b ${
                  isCompleted
                    ? 'border-border/20 bg-surface/20'
                    : hasError
                    ? 'border-red-500/20 bg-red-500/10'
                    : 'border-border/50 bg-surface'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isCompleted ? 'opacity-40' : ''
                    }`}
                    style={{ backgroundColor: agentColor }}
                  />
                  <span
                    className={`text-xs font-mono font-semibold truncate ${
                      isCompleted ? 'text-text-secondary/60' : ''
                    }`}
                    style={{ color: isCompleted ? undefined : agentColor }}
                  >
                    {agent}
                  </span>
                  {entryCount > 0 && (
                    <span className="text-[10px] text-text-secondary/50 ml-auto shrink-0">
                      {entryCount}
                    </span>
                  )}
                  {isCompleted && (
                    <Check className="w-3 h-3 text-green-500/60 shrink-0" />
                  )}
                  {hasError && (
                    <X className="w-3 h-3 text-red-500/60 shrink-0" />
                  )}
                </div>
              </div>

              {/* Compact mode: just show expand button */}
              {isCompactCandidate ? (
                <button
                  type="button"
                  onClick={() => toggleCompact(agent)}
                  className="flex-1 flex items-center justify-center gap-1 p-2 text-xs text-text-secondary/50 hover:text-text-secondary hover:bg-white/[0.02] transition-colors"
                  data-testid="compact-expand"
                >
                  {entryCount === 0 ? (
                    <span>No activity</span>
                  ) : (
                    <>
                      <span>{entryCount} event</span>
                      <ChevronRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              ) : (
                /* Events List */
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="divide-y divide-border/30">
                    {agentEntriesList.map((entry, idx) => {
                      if (entry.type === 'burst') {
                        const burst = entry as BurstEntry;
                        return (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-2 text-xs hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-start gap-1.5">
                              <span className="text-gray-600 font-mono shrink-0 text-[10px]">
                                {formatTime(burst.firstTimestamp)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-text-secondary truncate">
                                  {Object.entries(burst.toolBreakdown)
                                    .map(([tool, count]) => `${tool} ×${count}`)
                                    .join(', ')}
                                </div>
                                {burst.durationMs > 0 && (
                                  <div className="text-gray-600 text-[10px]">
                                    {Math.round(burst.durationMs / 1000)}s
                                  </div>
                                )}
                                {burst.errorCount > 0 && (
                                  <div className="text-red-400 text-[10px] flex items-center gap-1 mt-0.5">
                                    <AlertCircle className="w-2.5 h-2.5" />
                                    {burst.errorCount} error{burst.errorCount > 1 ? 's' : ''}
                                  </div>
                                )}
                                {burst.pendingCount > 0 && (
                                  <div className="text-accent text-[10px] flex items-center gap-1 mt-0.5">
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                    {burst.pendingCount} pending
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      const milestone = entry as MilestoneEntry;
                      const item = milestone.item;

                      if (item.type === 'agent-spawn') {
                        return (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-2 text-xs bg-accent/5 hover:bg-accent/10 transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-600 font-mono shrink-0 text-[10px]">
                                {formatTime(item.timestamp)}
                              </span>
                              <span className="text-text-secondary">→</span>
                              <span
                                className="font-mono font-semibold truncate"
                                style={{ color: getAgentColor(item.spawnedAgentName) }}
                              >
                                {item.spawnedAgentName}
                              </span>
                            </div>
                          </motion.div>
                        );
                      }

                      if (item.type === 'agent-complete') {
                        return (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`p-2 text-xs ${
                              item.status === 'completed'
                                ? 'bg-green-500/5 hover:bg-green-500/10'
                                : 'bg-red-500/5 hover:bg-red-500/10'
                            } transition-colors`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-600 font-mono shrink-0 text-[10px]">
                                {formatTime(item.timestamp)}
                              </span>
                              {item.status === 'completed' ? (
                                <Check className="w-3 h-3 text-green-500 shrink-0" />
                              ) : (
                                <X className="w-3 h-3 text-red-500 shrink-0" />
                              )}
                              <span className="text-text-secondary truncate">
                                {item.status}
                              </span>
                              {item.durationMs != null && (
                                <span className="text-gray-600 text-[10px] ml-auto shrink-0">
                                  {Math.round(item.durationMs / 1000)}s
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      }

                      if (item.type === 'tool-call' && item.state === 'error') {
                        return (
                          <motion.div
                            key={entry.id}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="p-2 text-xs bg-red-500/5 hover:bg-red-500/10 transition-colors border-l-2 border-l-red-500"
                          >
                            <div className="flex items-start gap-1.5">
                              <span className="text-gray-600 font-mono shrink-0 text-[10px]">
                                {formatTime(item.timestamp)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-red-300 font-medium truncate">
                                  {item.toolName}
                                </div>
                                <div className="text-red-300/70 text-[10px] truncate">
                                  {item.error || 'Error'}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      return null;
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
