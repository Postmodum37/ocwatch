import { render, screen } from '@testing-library/react'
import { PlanProgress as PlanProgressComponent } from '../PlanProgress'
import type { PlanProgress } from '@shared/types'
import { describe, it, expect } from 'vitest'

const mockPlan: PlanProgress = {
  completed: 3,
  total: 5,
  progress: 60,
  tasks: [
    { description: 'Setup project', completed: true },
    { description: 'Build components', completed: true },
    { description: 'Write tests', completed: true },
    { description: 'Connect API', completed: false },
    { description: 'Polish UI', completed: false },
  ]
};

describe('PlanProgress', () => {
  it('renders plan name', () => {
    render(<PlanProgressComponent plan={mockPlan} planName="Current Plan" />)
    expect(screen.getByText('Current Plan')).toBeDefined()
  })

  it('renders progress percentage', () => {
    render(<PlanProgressComponent plan={mockPlan} planName="Current Plan" />)
    expect(screen.getByText('60%')).toBeDefined()
  })

  it('renders tasks completion status', () => {
    render(<PlanProgressComponent plan={mockPlan} planName="Current Plan" />)
    expect(screen.getByText('3 of 5 tasks completed')).toBeDefined()
  })

  it('renders all tasks', () => {
    render(<PlanProgressComponent plan={mockPlan} planName="Current Plan" />)
    expect(screen.getByText('Setup project')).toBeDefined()
    expect(screen.getByText('Connect API')).toBeDefined()
  })

  it('renders empty state when no plan provided', () => {
    const { container } = render(<PlanProgressComponent plan={null} planName="Current Plan" />)
    const shimmerElements = container.querySelectorAll('[class*="animate-shimmer"]');
    expect(shimmerElements.length).toBeGreaterThan(0)
  })
})
