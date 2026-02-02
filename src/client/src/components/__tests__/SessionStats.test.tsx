import { render, screen } from '@testing-library/react'
import { SessionStats } from '../SessionStats'
import type { SessionStats as SessionStatsType } from '@shared/types'
import { describe, it, expect } from 'vitest'

describe('SessionStats', () => {
  const mockStats: SessionStatsType = {
    totalTokens: 18518,
    cost: 0.23,
    modelBreakdown: [
      { model: 'claude-opus-4', tokens: 10000 },
      { model: 'claude-sonnet-4', tokens: 8518 },
    ],
  }

  it('renders total tokens formatted with commas', () => {
    render(<SessionStats stats={mockStats} />)
    expect(screen.getByText('18,518 tokens')).toBeDefined()
  })

  it('renders cost formatted with $ and 2 decimals', () => {
    render(<SessionStats stats={mockStats} />)
    expect(screen.getByText('$0.23')).toBeDefined()
  })

  it('renders "—" when cost is undefined', () => {
    const statsNoCost: SessionStatsType = {
      totalTokens: 18518,
      cost: undefined,
      modelBreakdown: [
        { model: 'claude-opus-4', tokens: 10000 },
      ],
    }
    render(<SessionStats stats={statsNoCost} />)
    expect(screen.getByText('—')).toBeDefined()
  })

  it('renders model breakdown list with model names and token counts', () => {
    render(<SessionStats stats={mockStats} />)
    expect(screen.getByText('claude-opus-4')).toBeDefined()
    expect(screen.getByText('claude-sonnet-4')).toBeDefined()
    expect(screen.getByText('10,000')).toBeDefined()
    expect(screen.getByText('8,518')).toBeDefined()
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
      cost: 0.10,
      modelBreakdown: [],
    }
    render(<SessionStats stats={statsEmptyBreakdown} />)
    expect(screen.getByText('5,000 tokens')).toBeDefined()
    expect(screen.getByText('$0.10')).toBeDefined()
  })
})
