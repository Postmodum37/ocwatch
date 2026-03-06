import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useSSE } from '../hooks/useSSE';
import { useSelectedActivityGraph } from '../hooks/useSelectedActivityGraph';
import type {
  ActivitySession,
  MessageMeta,
  PlanProgress,
  SessionDetail,
  SessionStats,
  SessionSummary,
} from '@shared/types';
import { useUIState } from './UIStateContext';

interface PollDataContextValue {
  sessions: SessionSummary[];
  planProgress: PlanProgress | null;
  planName: string | undefined;
  loading: boolean;
  error: Error | null;
  lastUpdate: number;
  isReconnecting: boolean;
  sessionDetail: SessionDetail | null;
  sessionDetailLoading: boolean;
  sessionStats: SessionStats | null;
  messages: MessageMeta[];
  activitySessions: ActivitySession[];
}

interface PollDataProviderProps {
  children: ReactNode;
  apiUrl?: string;
  pollingInterval?: number;
}

const PollDataContext = createContext<PollDataContextValue | undefined>(undefined);

export function PollDataProvider({ children, apiUrl, pollingInterval }: PollDataProviderProps) {
  const { selectedProjectId, selectedSessionId } = useUIState();

  const { data, loading, error, lastUpdate, isReconnecting } = useSSE({
    apiUrl,
    pollingInterval,
    projectId: selectedProjectId,
  });

  const sessions = data?.sessions || [];
  const {
    data: activityGraph,
    loading: sessionDetailLoading,
  } = useSelectedActivityGraph({
    selectedSessionId,
    apiUrl,
    projectId: selectedProjectId,
    refreshToken: lastUpdate,
  });

  const activitySessions = activityGraph?.activity ?? [];
  const messages: MessageMeta[] = [];
  const sessionStats = activityGraph?.stats ?? null;
  const sessionDetail: SessionDetail | null = null;

  return (
    <PollDataContext.Provider
      value={{
        sessions,
        planProgress: data?.planProgress || null,
        planName: data?.planName,
        loading,
        error,
        lastUpdate,
        isReconnecting,
        sessionDetail,
        sessionDetailLoading,
        sessionStats,
        messages,
        activitySessions,
      }}
    >
      {children}
    </PollDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePollData(): PollDataContextValue {
  const context = useContext(PollDataContext);
  if (context === undefined) {
    throw new Error('usePollData must be used within PollDataProvider');
  }
  return context;
}
