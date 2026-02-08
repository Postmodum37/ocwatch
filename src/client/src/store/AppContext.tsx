import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSSE } from '../hooks/useSSE';
import { useNotifications } from '../hooks/useNotifications';
import type { SessionMetadata, PlanProgress, ProjectInfo, MessageMeta, ActivitySession, SessionStats } from '@shared/types';

interface AppContextValue {
  sessions: SessionMetadata[];
  activeSession: SessionMetadata | null;
  planProgress: PlanProgress | null;
  planName: string | undefined;
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

  const userHasSelectedRef = React.useRef(false);
  const setSelectedProjectId = React.useCallback((id: string) => {
    userHasSelectedRef.current = true;
    setSelectedProjectIdRaw(id);
  }, []);

  const prevProjectIdRef = React.useRef(selectedProjectId);
  useEffect(() => {
    if (prevProjectIdRef.current !== selectedProjectId) {
      prevProjectIdRef.current = selectedProjectId;
      setSelectedSessionId(null);
    }
  }, [selectedProjectId]);

  const { data, loading, error, lastUpdate, isReconnecting } = useSSE({
    apiUrl,
    pollingInterval,
    sessionId: selectedSessionId,
    projectId: selectedProjectId,
  });
  
  const {
    permission: notificationPermission,
    requestPermission: requestNotificationPermission,
  } = useNotifications(
    data?.sessions || [],
    isReconnecting,
    data?.activitySessions || []
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
    activeSession: data?.activeSession || null,
    planProgress: data?.planProgress || null,
    planName: data?.planName,
    sessionStats: data?.sessionStats || null,
    messages: data?.messages || [],
    activitySessions: data?.activitySessions || [],
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
  }), [data, selectedSessionId, projects, selectedProjectId, loading, error, lastUpdate, isReconnecting, agentFilter, notificationPermission, requestNotificationPermission, setSelectedProjectId]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
