import React, { useMemo } from 'react';
import { usePollData } from '../../store/PollDataContext';
import { useUIState } from '../../store/UIStateContext';
import { useSessionDetail } from '../../store/SessionDetailContext';
import { formatDuration, shortModelName } from '../../utils/formatters';
import { getAgentColor } from '../../utils/agentColors';
import { StatusDot } from './StatusDot';

export const ScopeSnapshot: React.FC = () => {
  const { sessions } = usePollData();
  const { selectedSessionId } = useUIState();
  const { activitySessions } = useSessionDetail();

  const selectedSession = useMemo(() => 
    sessions.find(s => s.id === selectedSessionId), 
  [sessions, selectedSessionId]);

  const globalStats = useMemo(() => {
    if (selectedSessionId) return null;
    
    let working = 0;
    let idle = 0;
    let waiting = 0;
    let completed = 0;

    sessions.forEach(s => {
      if (s.status === 'working') working++;
      else if (s.status === 'idle') idle++;
      else if (s.status === 'waiting') waiting++;
      else completed++;
    });

    return { working, idle, waiting, completed };
  }, [sessions, selectedSessionId]);

  const sessionStats = useMemo(() => {
    if (!selectedSessionId || !selectedSession) return null;

    const agentCount = activitySessions.filter(
      s => s.id === selectedSessionId || s.parentID === selectedSessionId
    ).length;

    return {
      agentCount,
      duration: formatDuration(selectedSession.createdAt, selectedSession.updatedAt),
      model: selectedSession.modelID ? shortModelName(selectedSession.modelID) : '—',
      color: getAgentColor(selectedSession.agent)
    };
  }, [selectedSessionId, selectedSession, activitySessions]);

  if (!selectedSessionId) {
    return (
      <div 
        className="flex flex-col gap-2 p-3 bg-surface rounded-md border border-border"
        data-testid="scope-snapshot"
      >
        <div className="flex justify-between items-center">
          <span className="text-xs font-medium text-text-primary">All sessions</span>
          <span className="text-xs font-mono text-text-secondary bg-background px-1.5 rounded-sm">
            {sessions.length}
          </span>
        </div>
        
        <div className="flex gap-2 text-[10px] font-mono">
          {globalStats && (
            <>
              {globalStats.working > 0 && (
                <><span className="text-accent">{globalStats.working} working</span><span className="text-text-secondary">·</span></>
              )}
              {globalStats.idle > 0 && (
                <><span className="text-success">{globalStats.idle} idle</span><span className="text-text-secondary">·</span></>
              )}
              {globalStats.waiting > 0 && (
                <><span className="text-warning">{globalStats.waiting} waiting</span><span className="text-text-secondary">·</span></>
              )}
              <span className="text-text-secondary">{globalStats.completed} done</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col gap-2 p-3 bg-surface rounded-md border border-border"
      data-testid="scope-snapshot"
    >
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot status={selectedSession?.status} color={sessionStats?.color || '#6b7280'} />
          <span className="text-xs font-medium text-text-primary truncate">
            {selectedSession?.title || 'Untitled Session'}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center text-[10px] text-text-secondary">
        <div className="flex items-center gap-2 min-w-0 font-mono">
          <span>{sessionStats?.duration}</span>
          <span>·</span>
          <span className="truncate">{sessionStats?.model}</span>
        </div>
        
        {sessionStats && sessionStats.agentCount > 0 && (
          <span className="font-mono bg-background px-1.5 rounded-sm">
            {sessionStats.agentCount} agent{sessionStats.agentCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};
