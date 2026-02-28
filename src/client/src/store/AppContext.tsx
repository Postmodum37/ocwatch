import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import type { SessionSummary, SessionDetail, PlanProgress, ProjectInfo, MessageMeta, ActivitySession, SessionStats } from '@shared/types';
import { UIStateProvider, useUIState } from './UIStateContext';
import { PollDataProvider, usePollData } from './PollDataContext';
import { SessionDetailProvider, useSessionDetail } from './SessionDetailContext';

interface AppContextValue {
  sessions: SessionSummary[];
  sessionDetail: SessionDetail | null;
  sessionDetailLoading: boolean;
  planProgress: PlanProgress | null;
  planName: string | undefined;
  // Derived from sessionDetail for backward compat with components
  sessionStats: SessionStats | null;
  messages: MessageMeta[];
  activitySessions: ActivitySession[];
  selectedSessionId: string | null;
  projects: ProjectInfo[];
  selectedProjectId: string | null;
  loading: boolean;
  error: Error | null;
  lastUpdate: number;
  isReconnecting: boolean;
  agentFilter: string[];
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  setSelectedSessionId: (id: string | null) => void;
  setSelectedProjectId: (id: string) => void;
  setAgentFilter: (agents: string[]) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
  apiUrl?: string;
  pollingInterval?: number;
}

export function AppProvider({ children, apiUrl, pollingInterval }: AppProviderProps) {
  return (
    <UIStateProvider apiUrl={apiUrl}>
      <PollDataProvider apiUrl={apiUrl} pollingInterval={pollingInterval}>
        <SessionDetailProvider apiUrl={apiUrl}>
          <AppContextBridge>{children}</AppContextBridge>
        </SessionDetailProvider>
      </PollDataProvider>
    </UIStateProvider>
  );
}

function AppContextBridge({ children }: { children: ReactNode }) {
  const pollData = usePollData();
  const sessionDetail = useSessionDetail();
  const uiState = useUIState();

  const {
    permission: notificationPermission,
    requestPermission: requestNotificationPermission,
  } = useNotifications(
    pollData.sessions,
    pollData.isReconnecting,
    sessionDetail.activitySessions
  );

  useEffect(() => {
    const hasWaitingUser = pollData.sessions.some(s => s.activityType === 'waiting-user');
    document.title = hasWaitingUser ? '⚡ Input needed — OCWatch' : 'OCWatch';
  }, [pollData.sessions]);

  const value = useMemo<AppContextValue>(() => ({
    sessions: pollData.sessions,
    sessionDetail: sessionDetail.sessionDetail,
    sessionDetailLoading: sessionDetail.sessionDetailLoading,
    planProgress: pollData.planProgress,
    planName: pollData.planName,
    sessionStats: sessionDetail.sessionStats,
    messages: sessionDetail.messages,
    activitySessions: sessionDetail.activitySessions,
    selectedSessionId: uiState.selectedSessionId,
    projects: uiState.projects,
    selectedProjectId: uiState.selectedProjectId,
    loading: pollData.loading,
    error: pollData.error,
    lastUpdate: pollData.lastUpdate,
    isReconnecting: pollData.isReconnecting,
    agentFilter: uiState.agentFilter,
    notificationPermission,
    requestNotificationPermission,
    setSelectedSessionId: uiState.setSelectedSessionId,
    setSelectedProjectId: uiState.setSelectedProjectId,
    setAgentFilter: uiState.setAgentFilter,
  }), [
    pollData.sessions,
    pollData.planProgress,
    pollData.planName,
    pollData.loading,
    pollData.error,
    pollData.lastUpdate,
    pollData.isReconnecting,
    sessionDetail.sessionDetail,
    sessionDetail.sessionDetailLoading,
    sessionDetail.sessionStats,
    sessionDetail.messages,
    sessionDetail.activitySessions,
    uiState.selectedSessionId,
    uiState.projects,
    uiState.selectedProjectId,
    uiState.agentFilter,
    uiState.setSelectedSessionId,
    uiState.setSelectedProjectId,
    uiState.setAgentFilter,
    notificationPermission,
    requestNotificationPermission,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
