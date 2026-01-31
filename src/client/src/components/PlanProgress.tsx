import { CheckSquare, Square, ListTodo } from 'lucide-react'
import type { PlanProgress } from '@shared/types'

interface PlanProgressProps {
  plan: PlanProgress | null
  planName?: string
}

export function PlanProgress({ plan, planName }: PlanProgressProps) {
  if (!plan) {
    return (
      <div 
        className="flex items-center gap-2 p-4 text-text-secondary bg-surface rounded-lg border border-border"
        data-testid="plan-progress"
      >
        <ListTodo className="w-5 h-5" />
        <span>No active plan</span>
      </div>
    )
  }

  return (
    <div 
      className="flex flex-col gap-3 p-4 bg-surface rounded-lg border border-border min-w-[300px]"
      data-testid="plan-progress"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-text-primary">
          {planName || 'Current Plan'}
        </h3>
        <span className="text-sm text-text-secondary">
          {plan.progress}%
        </span>
      </div>

      <div className="w-full bg-background rounded-full h-2">
        <div 
          className="bg-accent h-2 rounded-full transition-all duration-500 ease-in-out"
          style={{ width: `${plan.progress}%` }}
        />
      </div>

      <div className="text-xs text-text-secondary mb-1">
        {plan.completed} of {plan.total} tasks completed
      </div>

      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
        {plan.tasks.map((task, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            {task.completed ? (
              <CheckSquare className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            ) : (
              <Square className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
            )}
            <span className={task.completed ? 'text-text-secondary line-through' : 'text-text-primary'}>
              {task.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
