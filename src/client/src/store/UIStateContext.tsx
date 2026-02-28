import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ProjectInfo } from '@shared/types';

interface UIStateContextValue {
  selectedSessionId: string | null;
  selectedProjectId: string | null;
  agentFilter: string[];
  projects: ProjectInfo[];
  setSelectedSessionId: (id: string | null) => void;
  setSelectedProjectId: (id: string) => void;
  setAgentFilter: (agents: string[]) => void;
}

interface UIStateProviderProps {
  children: ReactNode;
  apiUrl?: string;
}

const UIStateContext = createContext<UIStateContextValue | undefined>(undefined);

export function UIStateProvider({ children, apiUrl }: UIStateProviderProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectIdRaw] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string[]>([]);
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
      setTimeout(() => setSelectedSessionId(null), 0);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    const baseUrl = apiUrl || '';
    let cancelled = false;

    const init = async () => {
      const [projectsResult, healthResult] = await Promise.allSettled([
        fetch(`${baseUrl}/api/projects`).then(r => (r.ok ? r.json() : [])),
        fetch(`${baseUrl}/api/health`).then(r => (r.ok ? r.json() : {})),
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
      const serverDefault: string | undefined = (healthData as Record<string, unknown>)
        .defaultProjectId as string | undefined;
      const firstProject = projectsData.length > 0 ? projectsData[0].id : null;

      const candidates = [urlParam, serverDefault, firstProject];
      const resolved = candidates.find(c => c != null && projectIds.has(c)) ?? null;
      if (resolved) {
        setSelectedProjectIdRaw(resolved);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const params = new URLSearchParams(window.location.search);
    params.set('project', selectedProjectId);
    const qs = params.toString();
    window.history.replaceState({}, '', `?${qs}`);
  }, [selectedProjectId]);

  return (
    <UIStateContext.Provider
      value={{
        selectedSessionId,
        selectedProjectId,
        agentFilter,
        projects,
        setSelectedSessionId,
        setSelectedProjectId,
        setAgentFilter,
      }}
    >
      {children}
    </UIStateContext.Provider>
  );
}

export function useUIState(): UIStateContextValue {
  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error('useUIState must be used within UIStateProvider');
  }
  return context;
}
