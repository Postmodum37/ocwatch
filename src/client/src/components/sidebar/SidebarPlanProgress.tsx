import React from 'react';
import { useAppContext } from '../../store/AppContext';

export const SidebarPlanProgress: React.FC = () => {
  const { planProgress } = useAppContext();

  if (!planProgress) {
    return (
      <div 
        className="p-3 bg-surface rounded-md border border-border text-xs text-text-secondary text-center"
        data-testid="sidebar-plan-empty"
      >
        No plan
      </div>
    );
  }

  const { completed, total, progress, tasks } = planProgress;
  
  const currentTask = tasks.find(t => !t.completed);
  
  const percent = Math.min(100, Math.max(0, progress));

  return (
    <div 
      className="flex flex-col gap-2 p-3 bg-surface rounded-md border border-border"
      data-testid="sidebar-plan-progress"
    >
      <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
        Plan
      </span>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs font-mono text-text-secondary whitespace-nowrap">
          {completed}/{total} tasks
        </span>
      </div>

      {currentTask && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
            Current
          </span>
          <span className="text-xs text-text-primary truncate" title={currentTask.description}>
            {currentTask.description}
          </span>
        </div>
      )}
      
      {!currentTask && completed === total && (
         <div className="text-xs text-success">All tasks completed</div>
      )}
    </div>
  );
};
