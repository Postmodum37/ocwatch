import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import type { ActivityItem } from '@shared/types';
import { ActivityRow } from './ActivityRow';
import { getAgentColor } from '../utils/agentColors';

interface ActivityStreamProps {
  items: ActivityItem[];
  totalTokens?: number;
}

export const ActivityStream = memo<ActivityStreamProps>(function ActivityStream({ items, totalTokens = 0 }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const prevAgentsRef = useRef<string>('');
  
  // Badge state tracking
  const [newItemsCount, setNewItemsCount] = useState(0);
  const prevItemsLengthRef = useRef(items.length);
  
  // Scroll position tracking
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showJumpButton, setShowJumpButton] = useState(false);

  const agents = useMemo(() => {
    const agentSet = new Set<string>();
    items.forEach(item => { agentSet.add(item.agentName); });
    return Array.from(agentSet).sort();
  }, [items]);

  useEffect(() => {
    const agentsKey = agents.join(',');
    if (prevAgentsRef.current !== '' && prevAgentsRef.current !== agentsKey) {
      setSelectedAgents(new Set());
    }
    prevAgentsRef.current = agentsKey;
  }, [agents]);

  // Detect new items and update badge count
  useEffect(() => {
    if (items.length > prevItemsLengthRef.current) {
      const diff = items.length - prevItemsLengthRef.current;
      setNewItemsCount(prev => prev + diff);
      
      // Auto-scroll to bottom if user was at bottom
      if (isAtBottom && scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }
    prevItemsLengthRef.current = items.length;
  }, [items, isAtBottom]);

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

  const filteredItems = useMemo(() => {
    if (selectedAgents.size === 0) return items;
    return items.filter(item => selectedAgents.has(item.agentName));
  }, [items, selectedAgents]);

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

  const toolCallCount = items.filter(i => i.type === 'tool-call').length;
  const agentCount = agents.length;

  const panelHeight = isCollapsed ? 'h-auto' : 'h-80 max-h-[50vh]';

  return (
    <motion.div 
      layout
      transition={{ duration: 0.3 }}
      className={`flex flex-col ${panelHeight} bg-surface border-t border-border shadow-lg w-full shrink-0 overflow-hidden`}
    >
       <div className="flex items-center justify-between p-3 border-b border-border bg-surface shrink-0">
         <div className="flex items-center gap-2">
           <Activity className="w-4 h-4 text-accent" />
           <h3 className="font-semibold text-sm">Activity Stream</h3>
           <span className="text-xs text-text-secondary bg-white/5 px-1.5 py-0.5 rounded-full">
             {filteredItems.length}
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

      {isCollapsed ? (
        <button 
          type="button"
          className="w-full p-3 bg-surface/50 text-xs text-text-secondary flex justify-between items-center cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => setIsCollapsed(false)}
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
          {agents.length > 0 && (
            <div className="p-2 border-b border-border bg-surface/50 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto shrink-0">
              <div className="flex items-center mr-1">
                <Filter className="w-3 h-3 text-text-secondary" />
              </div>
              {agents.map(agent => (
                <button
                  type="button"
                  key={agent}
                  onClick={() => toggleAgent(agent)}
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
              {filteredItems.length === 0 ? (
                <div className="p-4 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-surface rounded-lg">
                      <div className="w-4 h-4 rounded-full mt-1 animate-shimmer" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 rounded w-2/3 animate-shimmer" />
                        <div className="h-2 rounded w-1/3 animate-shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
               <AnimatePresence mode="popLayout" initial={false}>
                 {filteredItems.map(item => (
                   <motion.div
                     key={item.id}
                     initial={{ opacity: 0, y: -10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     transition={{ duration: 0.2 }}
                     layout
                   >
                     <ActivityRow item={item} />
                   </motion.div>
                 ))}
               </AnimatePresence>
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
     </motion.div>
   );
});
