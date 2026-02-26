import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSSE } from '../hooks/useSSE';
import { useNotifications } from '../hooks/useNotifications';
import type { SessionSummary, SessionDetail, PlanProgress, ProjectInfo, MessageMeta, ActivitySession, SessionStats } from '@shared/types';

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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string[]>([]);

  const [selectedProjectId, setSelectedProjectIdRaw] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);

  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false);

  const userHasSelectedRef = React.useRef(false);
  const setSelectedProjectId = React.useCallback((id: string) => {
    userHasSelectedRef.current = true;
    setSelectedProjectIdRaw(id);
  }, []);

  const prevProjectIdRef = React.useRef(selectedProjectId);
  useEffect(() => {
    if (prevProjectIdRef.current !== selectedProjectId) {
      prevProjectIdRef.current = selectedProjectId;
      setTimeout(() => setSelectedSessionId(null), 0);
    }
  }, [selectedProjectId]);

  const { data, loading, error, lastUpdate, isReconnecting } = useSSE({
    apiUrl,
    pollingInterval,
    projectId: selectedProjectId,
  });

  // Fetch session detail when selectedSessionId changes or data updates
  useEffect(() => {
    if (!selectedSessionId) {
      setSessionDetail(null);
      return;
    }

    const baseUrl = apiUrl || '';
    let cancelled = false;

    // Only show loading spinner on initial fetch, not on background refreshes
    const isInitialFetch = sessionDetail?.session.id !== selectedSessionId;
    if (isInitialFetch) {
      setSessionDetailLoading(true);
    }

    fetch(`${baseUrl}/api/sessions/${selectedSessionId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((detail: SessionDetail) => {
        if (!cancelled) {
          setSessionDetail(detail);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.warn('Failed to fetch session detail:', err);
          // Only clear detail on initial fetch failure
          if (isInitialFetch) {
            setSessionDetail(null);
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSessionDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId, apiUrl, lastUpdate]);

  // Derived values from sessionDetail
  const activitySessions = sessionDetail?.activity ?? [];
  const messages = sessionDetail?.messages ?? [];
  const sessionStats = sessionDetail?.stats ?? null;

  const {
    permission: notificationPermission,
    requestPermission: requestNotificationPermission,
  } = useNotifications(
    data?.sessions || [],
    isReconnecting,
    activitySessions
  );

  // Load projects + health on mount, auto-select with priority chain
  useEffect(() => {
    const baseUrl = apiUrl || '';
    let cancelled = false;

    const init = async () => {
      const [projectsResult, healthResult] = await Promise.allSettled([
        fetch(`${baseUrl}/api/projects`).then(r => r.ok ? r.json() : []),
        fetch(`${baseUrl}/api/health`).then(r => r.ok ? r.json() : {}),
      ]);

      if (cancelled) return;

      const projectsData: ProjectInfo[] =
        projectsResult.status === 'fulfilled' ? projectsResult.value : [];
      const healthData =
        healthResult.status === 'fulfilled' ? healthResult.value : {};

      setProjects(projectsData);

      if (userHasSelectedRef.current) return;

      const projectIds = new Set(projectsData.map(p => p.id));
      const urlParam = new URLSearchParams(window.location.search).get('project');
      const serverDefault: string | undefined = (healthData as Record<string, unknown>).defaultProjectId as string | undefined;
      const firstProject = projectsData.length > 0 ? projectsData[0].id : null;

      const candidates = [urlParam, serverDefault, firstProject];
      const resolved = candidates.find(c => c != null && projectIds.has(c)) ?? null;
      if (resolved) {
        setSelectedProjectIdRaw(resolved);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [apiUrl]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const params = new URLSearchParams(window.location.search);
    params.set('project', selectedProjectId);
    const qs = params.toString();
    window.history.replaceState({}, '', `?${qs}`);
  }, [selectedProjectId]);

  useEffect(() => {
    const sessions = data?.sessions || [];
    const hasWaitingUser = sessions.some(s => s.activityType === 'waiting-user');
    document.title = hasWaitingUser ? '⚡ Input needed — OCWatch' : 'OCWatch';
  }, [data?.sessions]);

  const value = useMemo<AppContextValue>(() => ({
    sessions: data?.sessions || [],
    sessionDetail,
    sessionDetailLoading,
    planProgress: data?.planProgress || null,
    planName: data?.planName,
    sessionStats,
    messages,
    activitySessions,
    selectedSessionId,
    projects,
    selectedProjectId,
    loading,
    error,
    lastUpdate,
    isReconnecting,
    agentFilter,
    notificationPermission,
    requestNotificationPermission,
    setSelectedSessionId,
    setSelectedProjectId,
    setAgentFilter,
  }), [data, sessionDetail, sessionDetailLoading, sessionStats, messages, activitySessions, selectedSessionId, projects, selectedProjectId, loading, error, lastUpdate, isReconnecting, agentFilter, notificationPermission, requestNotificationPermission, setSelectedProjectId]);

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
