import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSSE } from '../hooks/useSSE';
import type { SessionMetadata, PlanProgress, ProjectInfo, MessageMeta, ActivitySession, SessionStats } from '@shared/types';

interface AppContextValue {
  sessions: SessionMetadata[];
  activeSession: SessionMetadata | null;
  planProgress: PlanProgress | null;
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
  setSelectedSessionId: (id: string | null) => void;
  setSelectedProjectId: (id: string | null) => void;
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
  
  const { data, loading, error, lastUpdate, isReconnecting } = useSSE({
    apiUrl,
    pollingInterval,
    sessionId: selectedSessionId,
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);

  // Load projects from API on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const baseUrl = apiUrl || '';
        const response = await fetch(`${baseUrl}/api/projects`);
        if (response.ok) {
          const projectsData = await response.json();
          setProjects(projectsData);
          
          const params = new URLSearchParams(window.location.search);
          const projectParam = params.get('project');
          if (projectParam) {
            setSelectedProjectId(projectParam);
          }
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };

    fetchProjects();
  }, [apiUrl]);

  useEffect(() => {
    if (selectedProjectId) {
      const params = new URLSearchParams(window.location.search);
      params.set('project', selectedProjectId);
      window.history.replaceState({}, '', `?${params.toString()}`);
    }
  }, [selectedProjectId]);

  const value = useMemo<AppContextValue>(() => ({
    sessions: data?.sessions || [],
    activeSession: data?.activeSession || null,
    planProgress: data?.planProgress || null,
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
    setSelectedSessionId,
    setSelectedProjectId,
    setAgentFilter,
  }), [data, selectedSessionId, projects, selectedProjectId, loading, error, lastUpdate, isReconnecting, agentFilter]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
