import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from '../hooks/usePolling';
import type { SessionMetadata, PlanProgress, ProjectInfo } from '@shared/types';

interface AppContextValue {
  sessions: SessionMetadata[];
  activeSession: SessionMetadata | null;
  planProgress: PlanProgress | null;
  selectedSessionId: string | null;
  projects: ProjectInfo[];
  selectedProjectId: string | null;
  loading: boolean;
  error: Error | null;
  lastUpdate: number;
  isReconnecting: boolean;
  setSelectedSessionId: (id: string | null) => void;
  setSelectedProjectId: (id: string | null) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
  apiUrl?: string;
  pollingInterval?: number;
}

export function AppProvider({ children, apiUrl, pollingInterval }: AppProviderProps) {
  const { data, loading, error, lastUpdate, isReconnecting } = usePolling({
    apiUrl,
    interval: pollingInterval,
  });

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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
          } else if (projectsData.length > 0) {
            setSelectedProjectId(projectsData[0].id);
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

  const value: AppContextValue = {
    sessions: data?.sessions || [],
    activeSession: data?.activeSession || null,
    planProgress: data?.planProgress || null,
    selectedSessionId,
    projects,
    selectedProjectId,
    loading,
    error,
    lastUpdate,
    isReconnecting,
    setSelectedSessionId,
    setSelectedProjectId,
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
