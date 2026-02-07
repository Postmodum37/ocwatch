import React, { useState } from 'react';
import { CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppContext } from '../../store/AppContext';

export const SidebarPlanProgress: React.FC = () => {
  const { planProgress, planName } = useAppContext();
  const [expanded, setExpanded] = useState(false);

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
      className="flex flex-col gap-2 bg-surface rounded-md border border-border"
      data-testid="sidebar-plan-progress"
    >
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex flex-col gap-2 p-3 w-full text-left cursor-pointer hover:bg-white/[0.02] transition-colors rounded-md"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold truncate" title={planName}>
            {planName || 'Plan'}
          </span>
          {expanded ? (
            <ChevronUp className="w-3 h-3 text-text-secondary" />
          ) : (
            <ChevronDown className="w-3 h-3 text-text-secondary" />
          )}
        </div>
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

        {!expanded && currentTask && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
              Current
            </span>
            <span className="text-xs text-text-primary truncate" title={currentTask.description}>
              {currentTask.description}
            </span>
          </div>
        )}
        
        {!expanded && !currentTask && completed === total && (
           <div className="text-xs text-success">All tasks completed</div>
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-1 px-3 pb-3 max-h-64 overflow-y-auto">
          {tasks.map((task) => (
            <div key={task.description} className="flex items-start gap-1.5 text-[11px] leading-tight">
              {task.completed ? (
                <CheckSquare className="w-3 h-3 text-accent mt-0.5 shrink-0" />
              ) : (
                <Square className="w-3 h-3 text-text-secondary mt-0.5 shrink-0" />
              )}
              <span className={task.completed ? 'text-text-secondary line-through' : 'text-text-primary'}>
                {task.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
