import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSSE } from '../hooks/useSSE';
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

  // Session detail fetching (absorbed from SessionDetailContext)
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);
  const lastFetchedSessionIdRef = useRef<string | undefined>(undefined);
  const lastFetchedUpdatedAtRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedSessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionDetail(null);
      lastFetchedUpdatedAtRef.current = undefined;
      lastFetchedSessionIdRef.current = undefined;
      return;
    }

    const controller = new AbortController();
    const baseUrl = apiUrl || '';

    const isInitialFetch = lastFetchedSessionIdRef.current !== selectedSessionId;
    if (isInitialFetch) {
      setSessionDetailLoading(true);
      lastFetchedUpdatedAtRef.current = undefined;
    }

    fetch(`${baseUrl}/api/sessions/${selectedSessionId}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((detail: SessionDetail) => {
        setSessionDetail(detail);
        lastFetchedSessionIdRef.current = detail.session.id;
        lastFetchedUpdatedAtRef.current = detail.session.updatedAt.toString();
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.warn('Failed to fetch session detail:', err);
        if (isInitialFetch) {
          setSessionDetail(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSessionDetailLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedSessionId, apiUrl]);

  useEffect(() => {
    if (!selectedSessionId || sessions.length === 0) return;
    if (lastFetchedUpdatedAtRef.current === undefined) return;

    const selectedSession = sessions.find(s => s.id === selectedSessionId);
    if (!selectedSession) return;

    const currentUpdatedAt = selectedSession.updatedAt.toString();
    if (currentUpdatedAt === lastFetchedUpdatedAtRef.current) return;

    const controller = new AbortController();
    const baseUrl = apiUrl || '';

    fetch(`${baseUrl}/api/sessions/${selectedSessionId}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((detail: SessionDetail) => {
        setSessionDetail(detail);
        lastFetchedUpdatedAtRef.current = detail.session.updatedAt.toString();
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        console.warn('Failed to background refresh session detail:', err);
      });

    return () => {
      controller.abort();
    };
  }, [selectedSessionId, sessions, apiUrl]);

  const activitySessions = sessionDetail?.activity ?? [];
  const messages = sessionDetail?.messages ?? [];
  const sessionStats = sessionDetail?.stats ?? null;

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
