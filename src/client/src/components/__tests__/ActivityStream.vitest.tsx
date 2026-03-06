import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityStream } from '../ActivityStream';
import type { AgentSpawnActivity, AgentCompleteActivity } from '../../../../shared/types';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Activity: () => <div data-testid="icon-activity" />,
  ChevronDown: () => <div data-testid="icon-chevron-down" />,
  ChevronUp: () => <div data-testid="icon-chevron-up" />,
  ArrowDownRight: () => <div data-testid="icon-arrow-down-right" />,
  Check: () => <div data-testid="icon-check" />,
  X: () => <div data-testid="icon-x" />,
}));

type Entry = AgentSpawnActivity | AgentCompleteActivity;

describe('ActivityStream', () => {
  const mockSpawn: AgentSpawnActivity = {
    id: 'spawn-1',
    type: 'agent-spawn',
    timestamp: new Date('2025-02-02T10:01:00Z'),
    agentName: 'prometheus',
    spawnedAgentName: 'librarian',
  };

  const mockComplete: AgentCompleteActivity = {
    id: 'complete-1',
    type: 'agent-complete',
    timestamp: new Date('2025-02-02T10:02:00Z'),
    agentName: 'librarian',
    status: 'completed',
    durationMs: 5000,
  };

  const renderStream = (entries: Entry[]) => {
    return render(<ActivityStream entries={entries} />);
  };

  const expandStream = () => {
    const toggleButton = screen.getByLabelText('Toggle activity stream');
    fireEvent.click(toggleButton);
  };

  it('renders with empty data', () => {
    renderStream([]);
    expandStream();

    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('renders spawn entries', () => {
    renderStream([mockSpawn]);
    expandStream();

    expect(screen.getByText('librarian')).toBeInTheDocument();
    expect(screen.getByText(/from prometheus/)).toBeInTheDocument();
    expect(screen.getByTestId('icon-arrow-down-right')).toBeInTheDocument();
  });

  it('renders completion entries with status', () => {
    renderStream([mockComplete]);
    expandStream();

    expect(screen.getByText('librarian')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('5s')).toBeInTheDocument();
    expect(screen.getByTestId('icon-check')).toBeInTheDocument();
  });

  it('renders failed completion with X icon', () => {
    const failedComplete: AgentCompleteActivity = {
      ...mockComplete,
      id: 'fail-1',
      status: 'idle',
    };
    renderStream([failedComplete]);
    expandStream();

    expect(screen.getByTestId('icon-x')).toBeInTheDocument();
  });

  it('shows correct count badge', () => {
    renderStream([mockSpawn, mockComplete]);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('starts collapsed by default', () => {
    renderStream([mockSpawn]);

    expect(screen.queryByText('No activity yet')).not.toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });

  it('shows summary stats when collapsed', () => {
    renderStream([mockSpawn, mockComplete]);

    expect(screen.getByText(/2 events/)).toBeInTheDocument();
    expect(screen.getByText(/agents/)).toBeInTheDocument();
  });

  it('expands on toggle click', () => {
    renderStream([mockSpawn]);
    expandStream();

    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getByText('librarian')).toBeInTheDocument();
  });

  it('collapses on second toggle click', () => {
    renderStream([mockSpawn]);
    expandStream();

    expect(screen.getByRole('log')).toBeInTheDocument();

    expandStream();

    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });

  it('renders multiple entries in order', () => {
    const entries: Entry[] = [
      { ...mockSpawn, id: 'spawn-1', timestamp: new Date('2025-02-02T10:00:00Z'), spawnedAgentName: 'explore' },
      { ...mockSpawn, id: 'spawn-2', timestamp: new Date('2025-02-02T10:01:00Z'), spawnedAgentName: 'librarian' },
      { ...mockComplete, id: 'complete-1', timestamp: new Date('2025-02-02T10:02:00Z') },
    ];
    renderStream(entries);
    expandStream();

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('explore')).toBeInTheDocument();
    expect(screen.getAllByText('librarian').length).toBeGreaterThanOrEqual(1);
  });

  it('counts unique agents correctly', () => {
    const entries: Entry[] = [
      { ...mockSpawn, id: 'spawn-1', agentName: 'sisyphus', spawnedAgentName: 'explore' },
      { ...mockSpawn, id: 'spawn-2', agentName: 'sisyphus', spawnedAgentName: 'librarian' },
      { ...mockComplete, id: 'complete-1', agentName: 'explore' },
    ];
    renderStream(entries);

    expect(screen.getByText(/3 agents/)).toBeInTheDocument();
  });

  it('has aria-expanded attribute on toggle button', () => {
    renderStream([mockSpawn]);

    const button = screen.getByLabelText('Toggle activity stream');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('scroll container has aria-live for screen readers', () => {
    renderStream([mockSpawn]);
    expandStream();

    const logRegion = screen.getByRole('log');
    expect(logRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('handles completion without duration', () => {
    const noDuration: AgentCompleteActivity = {
      ...mockComplete,
      id: 'no-dur-1',
      durationMs: undefined,
    };
    renderStream([noDuration]);
    expandStream();

    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.queryByText(/\ds/)).not.toBeInTheDocument();
  });
});
