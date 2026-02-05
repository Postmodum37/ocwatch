import React, { useState } from 'react';
import { Loader2, Check, Circle, Folder, ChevronDown, Inbox, Clock } from 'lucide-react';
import type { SessionMetadata, ProjectInfo, SessionStatus, SessionActivityType } from '@shared/types';
import { EmptyState } from './EmptyState';

interface SessionListProps {
  sessions: SessionMetadata[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  projects?: ProjectInfo[];
  selectedProjectId?: string | null;
  onProjectSelect?: (id: string | null) => void;
}

const formatRelativeTime = (date: Date | string) => {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const SessionStatusIcon: React.FC<{ status: SessionStatus; activityType?: SessionActivityType }> = ({ status, activityType }) => {
  if (status === 'working') {
    return <Loader2 className="w-4 h-4 text-accent animate-spin" data-testid="session-status-working" />;
  }
  
  if (status === 'idle') {
    return <Circle className="w-4 h-4 text-success animate-pulse" data-testid="session-status-idle" />;
  }

  if (status === 'waiting') {
    if (activityType === 'waiting-user') {
      return <Clock className="w-4 h-4 text-warning" data-testid="session-status-waiting-user" />;
    }
    return <Circle className="w-4 h-4 text-text-secondary" data-testid="session-status-waiting" />;
  }

  return <Check className="w-4 h-4 text-text-secondary" data-testid="session-status-completed" />;
};

export const SessionList: React.FC<SessionListProps> = ({ 
  sessions, 
  selectedId, 
  onSelect,
  projects = [],
  selectedProjectId = null,
  onProjectSelect = () => {}
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const filteredSessions = selectedProjectId
    ? sessions.filter(s => s.projectID === selectedProjectId)
    : sessions;

  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectName = selectedProject?.directory.split('/').pop() || 'All Projects';

  const getProjectName = (projectID: string): string => {
    const project = projects.find(p => p.id === projectID);
    return project?.directory.split('/').pop() || projectID.slice(0, 8);
  };

  return (
    <div className="w-[280px] h-full bg-surface border-r border-border flex flex-col" data-testid="session-list">
      <div className="p-4 border-b border-border">
        <div className="relative mb-3">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            data-testid="project-dropdown-button"
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-background border border-border rounded hover:bg-surface transition-colors text-text-primary text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Folder className="w-4 h-4 text-accent shrink-0" />
              <span className="truncate">{projectName}</span>
            </div>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isDropdownOpen && (
            <div 
              className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded shadow-lg z-10"
              data-testid="project-dropdown-menu"
            >
              <button
                type="button"
                onClick={() => {
                  onProjectSelect(null);
                  setIsDropdownOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  selectedProjectId === null
                    ? 'bg-accent/20 text-accent'
                    : 'text-text-primary hover:bg-background'
                }`}
              >
                All Projects
              </button>
              {projects.map(project => (
                <button
                  type="button"
                  key={project.id}
                  onClick={() => {
                    onProjectSelect(project.id);
                    setIsDropdownOpen(false);
                  }}
                  data-testid={`project-option-${project.id}`}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                    selectedProjectId === project.id
                      ? 'bg-accent/20 text-accent'
                      : 'text-text-primary hover:bg-background'
                  }`}
                >
                  <span className="truncate">{project.directory.split('/').pop()}</span>
                  <span className="text-xs text-text-secondary ml-2 shrink-0">
                    {formatRelativeTime(project.lastActivityAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <h2 className="text-text-primary font-semibold text-lg">Sessions</h2>
      </div>
       <div className="flex-1 overflow-y-auto">
         {sortedSessions.length === 0 ? (
           <EmptyState
             icon={Inbox}
             title="No Sessions"
             description={selectedProjectId ? "No sessions found in this project" : "No active sessions in the last 24 hours"}
           />
         ) : (
           sortedSessions.map((session) => {
             const isSelected = session.id === selectedId;
             const status: SessionStatus = session.status || 'completed';
             const activityType = session.activityType;

             let borderClass = 'border-l-transparent';
             if (isSelected) {
               borderClass = 'border-l-accent';
             } else {
                if (status === 'working') borderClass = 'border-l-accent';
                else if (status === 'idle') borderClass = 'border-l-success';
                else if (status === 'waiting' && activityType === 'waiting-user') borderClass = 'border-l-warning';
                else if (status === 'completed') borderClass = 'border-l-transparent';
             }

             return (
               <button
                 type="button"
                 key={session.id}
                 data-testid={`session-item-${session.id}`}
                 onClick={() => onSelect(session.id)}
                 className={`w-full text-left p-3 border-b border-border hover:bg-background transition-colors flex flex-col gap-1 group border-l-2
                   ${borderClass}
                   ${isSelected ? 'bg-background' : ''}
                 `}
               >
                 <div className="flex items-center gap-2 w-full">
                   <div className="shrink-0 mt-0.5">
                     <SessionStatusIcon status={status} activityType={activityType} />
                   </div>
                   <h3 className={`font-medium truncate text-sm flex-1 ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                     {session.title || 'Untitled Session'}
                   </h3>
                   <span className="text-xs text-text-secondary shrink-0">
                     {formatRelativeTime(session.updatedAt)}
                   </span>
                 </div>

                 <div className="flex items-center gap-2 pl-6 w-full min-w-0">
                   <span className="text-xs text-text-secondary truncate flex-1 min-w-0" title={session.currentAction || ''}>
                     {session.currentAction || 'No active task'}
                   </span>
                   
                   {session.agent && (
                     <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface border border-border text-text-secondary shrink-0">
                       {session.agent}
                     </span>
                   )}
                   
                   {selectedProjectId === null && (
                     <span 
                       className="text-[10px] text-text-secondary bg-surface border border-border px-1.5 py-0.5 rounded truncate max-w-[80px] shrink-0" 
                       title={session.directory || session.projectID}
                     >
                       {getProjectName(session.projectID)}
                     </span>
                   )}
                 </div>
               </button>
             );
           })
         )}
       </div>
     </div>
  );
};
