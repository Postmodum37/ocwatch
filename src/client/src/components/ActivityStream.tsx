import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, ChevronDown, ChevronUp, Filter, X, LayoutList, Users, Diamond } from 'lucide-react';
import type { StreamEntry } from '@shared/types';
import { BurstRow } from './BurstRow';
import { MilestoneRow } from './MilestoneRow';
import { AgentSwimlane } from './AgentSwimlane';
import { getAgentColor } from '../utils/agentColors';

interface ActivityStreamProps {
  entries: StreamEntry[];
  totalTokens?: number;
}

export const ActivityStream = memo<ActivityStreamProps>(function ActivityStream({ entries, totalTokens = 0 }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'stream' | 'agents'>('stream');
  const [milestonesOnly, setMilestonesOnly] = useState(false);
  const prevAgentsRef = useRef<string>('');
  
  // Badge state tracking
  const [newItemsCount, setNewItemsCount] = useState(0);
  const prevEntriesLengthRef = useRef(entries.length);
  
  // Scroll position tracking
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showJumpButton, setShowJumpButton] = useState(false);

  const agents = useMemo(() => {
    const agentSet = new Set<string>();
    entries.forEach(entry => {
      if (entry.type === 'burst') {
        agentSet.add(entry.agentName);
      } else if (entry.type === 'milestone') {
        agentSet.add(entry.item.agentName);
      }
    });
    return Array.from(agentSet).sort();
  }, [entries]);

  useEffect(() => {
    const agentsKey = agents.join(',');
    if (prevAgentsRef.current !== '' && prevAgentsRef.current !== agentsKey) {
      setSelectedAgents(new Set());
    }
    prevAgentsRef.current = agentsKey;
  }, [agents]);

  // Detect new items and update badge count
  useEffect(() => {
    if (entries.length > prevEntriesLengthRef.current) {
      const diff = entries.length - prevEntriesLengthRef.current;
      setNewItemsCount(prev => prev + diff);
      
      if (isAtBottom && scrollRef.current) {
        setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 0);
      } else if (!isAtBottom) {
        setShowJumpButton(true);
      }
    }
    prevEntriesLengthRef.current = entries.length;
  }, [entries, isAtBottom]);

  // Handle scroll position tracking
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(atBottom);
      setShowJumpButton(!atBottom && newItemsCount > 0);
    }
  };

  // Scroll to bottom smoothly
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  // Toggle collapse and clear badge when expanding
  const handleToggleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    if (!newCollapsedState) {
      setNewItemsCount(0);
    }
  };

  const filteredEntries = useMemo(() => {
    let result = entries;
    
    // Filter by milestones only if toggle is ON
    if (milestonesOnly) {
      result = result.filter(entry => entry.type === 'milestone');
    }
    
    // Filter by selected agents
    if (selectedAgents.size === 0) return result;
    return result.filter(entry => {
        const agent = entry.type === 'burst' ? entry.agentName : entry.item.agentName;
        return selectedAgents.has(agent);
    });
  }, [entries, selectedAgents, milestonesOnly]);

  const toggleAgent = (agent: string) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agent)) {
      newSelected.delete(agent);
    } else {
      newSelected.add(agent);
    }
    setSelectedAgents(newSelected);
  };

  const clearFilters = () => {
    setSelectedAgents(new Set());
  };

  const panelHeight = isCollapsed ? 'h-auto' : 'h-80 max-h-[50vh]';
  
  const toolCallCount = entries.reduce((acc, entry) => {
    if (entry.type === 'burst') return acc + entry.items.length;
    if (entry.type === 'milestone' && entry.item.type === 'tool-call') return acc + 1;
    return acc;
  }, 0);
  
  const agentCount = agents.length;

  return (
    <div 
      className={`flex flex-col ${panelHeight} bg-surface border-t border-border shadow-lg w-full shrink-0 overflow-hidden`}
    >
       <div className="flex flex-col border-b border-border bg-surface shrink-0">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-sm">Activity Stream</h3>
              <span className="text-xs text-text-secondary bg-white/5 px-1.5 py-0.5 rounded-full">
                {filteredEntries.length}
              </span>
              {isCollapsed && newItemsCount > 0 && (
                <span className="ml-2 bg-accent text-white text-xs px-2 py-0.5 rounded-full font-medium">
                  {newItemsCount > 9 ? '9+' : newItemsCount}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {selectedAgents.size > 0 && (
                <button 
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-text-secondary hover:text-white flex items-center gap-1 transition-colors"
                  title="Clear filters"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
               <button 
                 type="button"
                 onClick={handleToggleCollapse}
                 className="text-text-secondary hover:text-white transition-colors"
                 aria-expanded={!isCollapsed}
                 aria-label="Toggle activity stream"
               >
                 {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
               </button>
            </div>
          </div>

           {!isCollapsed && (
             <div className="flex items-center justify-between px-3 gap-4 border-t border-border/50">
                <div className="flex items-center gap-4">
                  <button 
                     type="button"
                     onClick={() => setActiveTab('stream')}
                     className={`py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'stream' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                  >
                     <LayoutList className="w-3.5 h-3.5" />
                     Stream
                  </button>
                  <button 
                     type="button"
                     onClick={() => setActiveTab('agents')}
                     className={`py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'agents' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
                  >
                     <Users className="w-3.5 h-3.5" />
                     Agents
                  </button>
                </div>
                {activeTab === 'stream' && (
                  <button
                    type="button"
                    onClick={() => setMilestonesOnly(!milestonesOnly)}
                    className={`text-text-secondary hover:text-white transition-colors ${milestonesOnly ? 'text-accent' : ''}`}
                    aria-label="Toggle milestones only"
                    aria-pressed={milestonesOnly}
                    title="Milestones only"
                  >
                    <Diamond className="w-4 h-4" />
                  </button>
                )}
             </div>
           )}
       </div>

      {isCollapsed ? (
        <button 
          type="button"
          className="w-full p-3 bg-surface/50 text-xs text-text-secondary flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => { setIsCollapsed(false); setNewItemsCount(0); }}
        >
          <div className="flex items-center gap-4">
            <span>{toolCallCount} calls</span>
            <span>{agentCount} agents</span>
            {totalTokens > 0 && <span>{totalTokens.toLocaleString()} tokens</span>}
          </div>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      ) : (
        <>
          {activeTab === 'stream' && agents.length > 0 && (
            <div className="p-2 border-b border-border bg-surface/50 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto shrink-0">
              <div className="flex items-center mr-1">
                <Filter className="w-3 h-3 text-text-secondary" />
              </div>
              {agents.map(agent => (
                <button
                  type="button"
                  key={agent}
                  onClick={() => toggleAgent(agent)}
                  aria-pressed={selectedAgents.has(agent)}
                  className={`
                    text-[10px] px-2 py-0.5 rounded-full border transition-all
                    ${selectedAgents.has(agent) 
                      ? 'bg-opacity-20 border-opacity-50 text-white' 
                      : 'bg-transparent border-transparent text-text-secondary hover:bg-white/5 hover:text-gray-300'
                    }
                  `}
                  style={{ 
                    borderColor: selectedAgents.has(agent) ? getAgentColor(agent) : 'transparent',
                    backgroundColor: selectedAgents.has(agent) ? getAgentColor(agent) : undefined
                  }}
                >
                  {agent}
                </button>
              ))}
            </div>
          )}

            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto min-h-0 bg-[#0d1117] relative"
              aria-live="polite"
              role="log"
            >
              {activeTab === 'stream' ? (
                 filteredEntries.length === 0 ? (
                   <div className="p-8 text-center text-text-secondary text-sm">
                      No activity yet
                   </div>
                 ) : (
                  <AnimatePresence>
                    {filteredEntries.map((entry, index) => {
                      const delay = (index % 10) * 0.05;
                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0, transition: { delay } }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {entry.type === 'burst' ? (
                            <BurstRow burst={entry} />
                          ) : (
                            <MilestoneRow entry={entry} />
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )
               ) : (
                 <AgentSwimlane entries={filteredEntries} />
               )}
              
              {showJumpButton && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2 }}
                  onClick={scrollToBottom}
                  type="button"
                  className="absolute bottom-4 right-4 bg-accent text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-accent/90 transition-colors text-sm font-medium"
                >
                  Jump to latest <ChevronDown className="w-4 h-4" />
                </motion.button>
              )}
            </div>
        </>
      )}
    </div>
  );
});
