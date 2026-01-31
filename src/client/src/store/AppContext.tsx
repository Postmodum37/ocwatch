import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from '../hooks/usePolling';
import type { SessionMetadata, PlanProgress } from '@shared/types';

interface AppContextValue {
  sessions: SessionMetadata[];
  activeSession: SessionMetadata | null;
  planProgress: PlanProgress | null;
  selectedSessionId: string | null;
  loading: boolean;
  error: Error | null;
  lastUpdate: number;
  setSelectedSessionId: (id: string | null) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
  apiUrl?: string;
  pollingInterval?: number;
}

export function AppProvider({ children, apiUrl, pollingInterval }: AppProviderProps) {
  const { data, loading, error, lastUpdate } = usePolling({
    apiUrl,
    interval: pollingInterval,
  });

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const value: AppContextValue = {
    sessions: data?.sessions || [],
    activeSession: data?.activeSession || null,
    planProgress: data?.planProgress || null,
    selectedSessionId,
    loading,
    error,
    lastUpdate,
    setSelectedSessionId,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
