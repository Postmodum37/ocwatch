import React, { useMemo } from 'react';
import { useAppContext } from '../../store/AppContext';
import { formatTokens, shortModelName } from '../../utils/formatters';
import { getAgentColor } from '../../utils/agentColors';
import { StatusDot } from './StatusDot';
import type { ActivitySession } from '@shared/types';

export const ActiveAgents: React.FC = () => {
  const { activitySessions, selectedSessionId } = useAppContext();

  const { displayAgents, overflowCount, isSessionMode } = useMemo(() => {
    let filtered: ActivitySession[] = [];
    const isSessionMode = !!selectedSessionId;

    if (isSessionMode) {
      filtered = activitySessions.filter(
        s => s.id === selectedSessionId || s.parentID === selectedSessionId
      );
    } else {
      filtered = activitySessions.filter(s => 
        s.status === 'working' || s.status === 'idle'
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      const scoreA = a.status === 'working' ? 2 : a.status === 'idle' ? 1 : 0;
      const scoreB = b.status === 'working' ? 2 : b.status === 'idle' ? 1 : 0;
      
      if (scoreA !== scoreB) return scoreB - scoreA;
      return (b.tokens || 0) - (a.tokens || 0);
    });

    if (isSessionMode) {
      return {
        displayAgents: sorted.slice(0, 5),
        overflowCount: Math.max(0, sorted.length - 5),
        isSessionMode: true,
      };
    }

    return {
      displayAgents: sorted,
      overflowCount: 0,
      isSessionMode: false,
    };
  }, [activitySessions, selectedSessionId]);

  if (displayAgents.length === 0) {
    return (
      <div 
        className="p-3 bg-surface rounded-md border border-border text-xs text-text-secondary text-center"
        data-testid="active-agents-empty"
      >
        No active agents
      </div>
    );
  }

  return (
    <div 
      className="p-3 bg-surface rounded-md border border-border"
      data-testid="active-agents"
    >
      <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
        {displayAgents.map((session: ActivitySession) => (
          <AgentRow key={session.id} session={session} />
        ))}
      </div>
      
      {isSessionMode && overflowCount > 0 && (
        <div className="text-[10px] text-text-secondary text-center mt-1.5 pt-1.5 border-t border-border/50">
          +{overflowCount} more agents
        </div>
      )}
    </div>
  );
};

const AgentRow = React.memo<{ session: ActivitySession }>(({ session }) => {
  const agentColor = getAgentColor(session.agent);
  
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <StatusDot status={session.status} color={agentColor} />
        <span className="font-medium text-text-primary truncate flex-1 min-w-0" title={session.agent}>
          {session.agent}
        </span>
        <span className="text-[10px] text-text-secondary truncate max-w-[80px]" title={session.modelID}>
          {session.modelID ? shortModelName(session.modelID) : '—'}
        </span>
      </div>
      
      <span className="font-mono text-text-secondary whitespace-nowrap ml-1">
        {formatTokens(session.tokens || 0)}
      </span>
    </div>
  );
});


