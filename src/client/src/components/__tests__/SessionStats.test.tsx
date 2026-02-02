import { render, screen, fireEvent } from '@testing-library/react'
import { SessionStats } from '../SessionStats'
import type { SessionStats as SessionStatsType } from '@shared/types'
import { describe, it, expect } from 'vitest'

describe('SessionStats', () => {
  const mockStats: SessionStatsType = {
    totalTokens: 18518,
    totalCost: 0.23,
    modelBreakdown: [
      { modelID: 'claude-opus-4', tokens: 10000 },
      { modelID: 'claude-sonnet-4', tokens: 8518 },
    ],
  }

  it('renders total tokens formatted with k suffix', () => {
    render(<SessionStats stats={mockStats} />)
    expect(screen.getByText('19k')).toBeDefined()
  })

  it('renders cost formatted with $ and 2 decimals', () => {
    render(<SessionStats stats={mockStats} />)
    expect(screen.getByText('$0.23')).toBeDefined()
  })

  it('renders "—" when cost is undefined', () => {
    const statsNoCost: SessionStatsType = {
      totalTokens: 18518,
      totalCost: undefined,
      modelBreakdown: [
        { modelID: 'claude-opus-4', tokens: 10000 },
      ],
    }
    render(<SessionStats stats={statsNoCost} />)
    expect(screen.getByText('—')).toBeDefined()
  })

  it('renders model count button', () => {
    render(<SessionStats stats={mockStats} />)
    expect(screen.getByText('2 models')).toBeDefined()
  })

  it('opens dropdown on button click', () => {
    render(<SessionStats stats={mockStats} />)
    
    const button = screen.getByText('2 models')
    fireEvent.click(button)
    
    expect(screen.getByText('claude-opus-4')).toBeDefined()
    expect(screen.getByText('claude-sonnet-4')).toBeDefined()
  })

  it('displays model tokens formatted with k suffix in dropdown', () => {
    render(<SessionStats stats={mockStats} />)
    
    const button = screen.getByText('2 models')
    fireEvent.click(button)
    
    expect(screen.getByText('10k')).toBeDefined()
    expect(screen.getByText('9k')).toBeDefined()
  })

  it('renders empty/placeholder state when stats prop is null', () => {
    render(<SessionStats stats={null} />)
    expect(screen.getByText('No stats available')).toBeDefined()
  })

  it('renders empty/placeholder state when stats prop is undefined', () => {
    render(<SessionStats stats={undefined} />)
    expect(screen.getByText('No stats available')).toBeDefined()
  })

  it('handles empty modelBreakdown array gracefully', () => {
    const statsEmptyBreakdown: SessionStatsType = {
      totalTokens: 5000,
      totalCost: 0.10,
      modelBreakdown: [],
    }
    render(<SessionStats stats={statsEmptyBreakdown} />)
    expect(screen.getByText('5k')).toBeDefined()
    expect(screen.getByText('$0.10')).toBeDefined()
    expect(screen.getByText('0 models')).toBeDefined()
  })

  it('preserves data-testid attributes', () => {
    render(<SessionStats stats={mockStats} />)
    expect(screen.getByTestId('session-stats')).toBeDefined()
  })

  it('preserves data-testid for empty state', () => {
    render(<SessionStats stats={null} />)
    expect(screen.getByTestId('session-stats-empty')).toBeDefined()
  })
})
