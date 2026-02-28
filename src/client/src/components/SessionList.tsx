import React, { useState, useMemo, memo } from 'react';
import { Loader2, Check, Circle, Folder, ChevronDown, Inbox, MessageCircleQuestion } from 'lucide-react';
import type { SessionSummary, ProjectInfo, SessionStatus, SessionActivityType } from '@shared/types';
import { formatRelativeTimeVerbose } from '@shared/utils/formatTime';
import { EmptyState } from './EmptyState';
import { ScopeSnapshot } from './sidebar/ScopeSnapshot';
import { ActiveAgents } from './sidebar/ActiveAgents';
import { SidebarPlanProgress } from './sidebar/SidebarPlanProgress';
import { SystemHealth } from './sidebar/SystemHealth';

interface SessionListProps {
  sessions: SessionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  projects?: ProjectInfo[];
  selectedProjectId?: string | null;
  onProjectSelect?: (id: string) => void;
}

const SessionStatusIcon: React.FC<{ status: SessionStatus; activityType?: SessionActivityType }> = ({ status, activityType }) => {
  if (status === 'working') {
    return <Loader2 className="w-4 h-4 text-accent animate-spin" data-testid="session-status-working" />;
  }
  
  if (status === 'idle') {
    return <Circle className="w-4 h-4 text-success animate-pulse" data-testid="session-status-idle" />;
  }

  if (status === 'waiting') {
    if (activityType === 'waiting-user') {
      return <MessageCircleQuestion className="w-4 h-4 text-warning animate-waiting-user-icon" data-testid="session-status-waiting-user" />;
    }
    return <Circle className="w-4 h-4 text-text-secondary" data-testid="session-status-waiting" />;
  }

  return <Check className="w-4 h-4 text-text-secondary" data-testid="session-status-completed" />;
};

export const SessionList = memo<SessionListProps>(function SessionList({
  sessions,
  selectedId,
  onSelect,
  projects = [],
  selectedProjectId = null,
  onProjectSelect = () => {}
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const sortedSessions = useMemo(() => {
    const filtered = selectedProjectId
      ? sessions.filter(s => s.projectID === selectedProjectId)
      : sessions;
    return [...filtered].sort((a, b) => {
      const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });
  }, [sessions, selectedProjectId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectName = selectedProject?.directory.split('/').pop() || 'Projects';


  return (
    <div className="w-[280px] h-full bg-surface border-r border-border flex flex-col" data-testid="session-list">
      <div className="p-4 border-b border-border">
        <div className="relative mb-3">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            data-testid="project-dropdown-button"
            title={selectedProject?.directory || 'Projects'}
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
              className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded shadow-lg z-10 max-h-[320px] overflow-y-auto"
              data-testid="project-dropdown-menu"
            >
              {projects.map(project => (
                <button
                  type="button"
                  key={project.id}
                  onClick={() => {
                    onProjectSelect(project.id);
                    setIsDropdownOpen(false);
                  }}
                  data-testid={`project-option-${project.id}`}
                  title={project.directory}
                  className={`w-full text-left pl-3 pr-3 py-2 text-sm transition-colors flex items-center justify-between border-l-2 ${
                    selectedProjectId === project.id
                      ? 'bg-accent/10 text-accent border-l-accent'
                      : 'text-text-primary hover:bg-background border-l-transparent'
                  }`}
                >
                  <span className="truncate">{project.directory.split('/').pop()}</span>
                  <span className="text-xs text-text-secondary ml-2 shrink-0">
                    {formatRelativeTimeVerbose(project.lastActivityAt)}
                  </span>
                </button>
              ))}

            </div>
          )}
        </div>
        <h2 className="text-text-primary font-semibold text-lg">Sessions</h2>
      </div>
        <div 
          className="flex-1 min-h-0 overflow-y-auto" 
          role="listbox" 
          aria-label="Sessions"
          tabIndex={0}
          aria-activedescendant={selectedId || undefined}
        >
          {sortedSessions.length === 0 ? (
           <EmptyState
             icon={Inbox}
             title="No Sessions"
              description="No sessions found in this project"
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
                 else if (status === 'waiting' && activityType === 'waiting-user') borderClass = 'border-l-transparent animate-attention';
                else if (status === 'completed') borderClass = 'border-l-transparent';
             }

              return (
                <button
                  type="button"
                  key={session.id}
                  data-testid={`session-item-${session.id}`}
                  onClick={() => onSelect(session.id)}
                  role="option"
                  aria-selected={isSelected}
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
                     {formatRelativeTimeVerbose(session.updatedAt)}
                   </span>
                 </div>

                 <div className="flex items-center gap-2 pl-6 w-full min-w-0">
                   <span className={`text-xs truncate flex-1 min-w-0 ${activityType === 'waiting-user' ? 'text-warning font-medium' : 'text-text-secondary'}`} title={session.currentAction || ''}>
                      {activityType === 'waiting-user' && (!session.currentAction || session.currentAction === 'question') ? '⚡ Needs your input' : (session.currentAction || 'No active task')}
                    </span>
                   
                   {session.agent && (
                     <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface border border-border text-text-secondary shrink-0">
                       {session.agent}
                     </span>
                   )}
                   

                 </div>
               </button>
             );
           })
         )}
       </div>

       {/* Sidebar Detail Widgets */}
       <div className="border-t border-border overflow-y-auto p-3 space-y-3 max-h-[45%] shrink-0">
         <ScopeSnapshot />
         <ActiveAgents />
         <SidebarPlanProgress />
       </div>

       {/* Pinned System Health Footer */}
       <SystemHealth />
     </div>
  );
});
