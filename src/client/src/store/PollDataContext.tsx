import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useSSE } from '../hooks/useSSE';
import type { PlanProgress, SessionSummary } from '@shared/types';
import { useUIState } from './UIStateContext';

interface PollDataContextValue {
  sessions: SessionSummary[];
  planProgress: PlanProgress | null;
  planName: string | undefined;
  loading: boolean;
  error: Error | null;
  lastUpdate: number;
  isReconnecting: boolean;
}

interface PollDataProviderProps {
  children: ReactNode;
  apiUrl?: string;
  pollingInterval?: number;
}

const PollDataContext = createContext<PollDataContextValue | undefined>(undefined);

export function PollDataProvider({ children, apiUrl, pollingInterval }: PollDataProviderProps) {
  const { selectedProjectId } = useUIState();

  const { data, loading, error, lastUpdate, isReconnecting } = useSSE({
    apiUrl,
    pollingInterval,
    projectId: selectedProjectId,
  });

  return (
    <PollDataContext.Provider
      value={{
        sessions: data?.sessions || [],
        planProgress: data?.planProgress || null,
        planName: data?.planName,
        loading,
        error,
        lastUpdate,
        isReconnecting,
      }}
    >
      {children}
    </PollDataContext.Provider>
  );
}

export function usePollData(): PollDataContextValue {
  const context = useContext(PollDataContext);
  if (context === undefined) {
    throw new Error('usePollData must be used within PollDataProvider');
  }
  return context;
}
