import { render, screen } from '@testing-library/react';
import { LiveActivity } from '../LiveActivity';
import type { ActivitySession } from '../../../../shared/types';
import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

vi.mock('lucide-react', () => ({
  Activity: () => <div data-testid="icon-activity" />,
  Check: () => <div data-testid="icon-check" />,
  Loader2: () => <div data-testid="icon-loader" />,
}));

describe('LiveActivity', () => {
  const mockSessions: ActivitySession[] = [
    {
      id: 'session-1',
      title: 'Root session',
      agent: 'prometheus',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      tokens: 1234,
      createdAt: new Date('2024-01-15T10:30:00'),
      updatedAt: new Date('2024-01-15T10:35:00'),
    },
    {
      id: 'session-2',
      title: 'Sub session 1',
      agent: 'sisyphus',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      parentID: 'session-1',
      tokens: 567,
      createdAt: new Date('2024-01-15T10:30:05'),
      updatedAt: new Date('2024-01-15T10:32:00'),
    },
    {
      id: 'session-3',
      title: 'Sub session 2',
      agent: 'explore',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      parentID: 'session-2',
      tokens: 89,
      createdAt: new Date('2024-01-15T10:30:10'),
      updatedAt: new Date('2024-01-15T10:31:00'),
    },
  ];

  it('renders empty state when no sessions', () => {
    render(<LiveActivity sessions={[]} loading={false} />);

    expect(screen.getByText('Live Activity')).toBeInTheDocument();
    expect(screen.getByText('No Activity')).toBeInTheDocument();
    expect(screen.getByText('Select a session to view live activity')).toBeInTheDocument();
  });

  it('renders loading skeleton when loading with no sessions', () => {
    render(<LiveActivity sessions={[]} loading={true} />);

    expect(screen.getByText('Live Activity')).toBeInTheDocument();
    expect(screen.queryByText('No Activity')).not.toBeInTheDocument();
  });

  it('renders sessions with agent badges', () => {
    render(<LiveActivity sessions={mockSessions} loading={false} />);

    expect(screen.getByText('prometheus')).toBeInTheDocument();
    expect(screen.getByText('sisyphus')).toBeInTheDocument();
    expect(screen.getByText('explore')).toBeInTheDocument();
  });

  it('displays model information', () => {
    render(<LiveActivity sessions={mockSessions} loading={false} />);

    const modelTexts = screen.getAllByText('anthropic/claude-sonnet-4');
    expect(modelTexts.length).toBeGreaterThan(0);
  });

  it('shows token count when available', () => {
    render(<LiveActivity sessions={mockSessions} loading={false} />);

    expect(screen.getByText('1,234 tokens')).toBeInTheDocument();
    expect(screen.getByText('567 tokens')).toBeInTheDocument();
    expect(screen.getByText('89 tokens')).toBeInTheDocument();
  });

  it('shows connected indicator when sessions exist', () => {
    render(<LiveActivity sessions={mockSessions} loading={false} />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('renders nested sessions with delegation indicator', () => {
    render(<LiveActivity sessions={mockSessions} loading={false} />);

    const delegationIndicators = screen.getAllByText('└');
    expect(delegationIndicators.length).toBe(2);
  });

  it('renders sessions with unknown agent when agent is missing', () => {
    const sessionsWithMissingAgent: ActivitySession[] = [
      {
        id: 'session-1',
        title: 'Test session',
        agent: 'unknown',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    render(<LiveActivity sessions={sessionsWithMissingAgent} loading={false} />);

    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});
