import { useState, useMemo, useEffect, useRef, memo } from 'react';
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

  const panelHeight = isCollapsed ? 'h-auto' : 'h-64 max-h-[40vh]';

  return (
    <div className={`flex flex-col ${panelHeight} bg-surface border-t border-border shadow-lg w-full shrink-0`}>
      <div className="flex items-center justify-between p-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Activity Stream</h3>
          <span className="text-xs text-text-secondary bg-white/5 px-1.5 py-0.5 rounded-full">
            {filteredItems.length}
          </span>
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
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-text-secondary hover:text-white transition-colors"
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

          <div className="flex-1 overflow-y-auto min-h-0 bg-[#0d1117]">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-text-secondary opacity-50 p-4 text-center">
                <Activity className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">No activity found</p>
                {selectedAgents.size > 0 && (
                  <p className="text-xs mt-1">Try clearing filters</p>
                )}
              </div>
            ) : (
              [...filteredItems].reverse().map(item => (
                <ActivityRow key={item.id} item={item} />
              ))
            )}
          </div>
        </>
      )}
     </div>
   );
});
