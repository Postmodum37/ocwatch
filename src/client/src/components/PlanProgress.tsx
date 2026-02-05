import { CheckSquare, Square } from 'lucide-react'
import type { PlanProgress as PlanProgressType } from '@shared/types'

interface PlanProgressProps {
  plan: PlanProgressType | null
  planName?: string
}

export function PlanProgress({ plan, planName }: PlanProgressProps) {
  if (!plan) {
    return (
      <div 
        className="flex flex-col gap-3 p-4 bg-surface rounded-lg border border-border min-w-[300px]"
        data-testid="plan-progress"
      >
        <div className="flex items-center justify-between">
          <div className="h-5 rounded w-24 animate-shimmer" />
          <div className="h-5 rounded w-12 animate-shimmer" />
        </div>
        <div className="w-full bg-background rounded-full h-2">
          <div className="bg-accent h-2 rounded-full animate-shimmer" />
        </div>
        <div className="h-3 rounded w-32 animate-shimmer" />
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-4 h-4 rounded mt-0.5 animate-shimmer" />
              <div className="flex-1 h-3 rounded animate-shimmer" />
            </div>
          ))}
        </div>
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

      <div className="w-full bg-background rounded-full h-2" role="progressbar" aria-valuenow={plan.completed} aria-valuemax={plan.total} aria-label="Plan progress">
        <div 
          className="bg-accent h-2 rounded-full transition-all duration-500 ease-in-out"
          style={{ width: `${plan.progress}%` }}
        />
      </div>

      <div className="text-xs text-text-secondary mb-1">
        {plan.completed} of {plan.total} tasks completed
      </div>

      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
        {plan.tasks.map((task) => (
          <div key={task.description} className="flex items-start gap-2 text-sm">
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
