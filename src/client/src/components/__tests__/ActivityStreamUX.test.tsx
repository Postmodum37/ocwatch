import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityStream } from '../ActivityStream';
import type { AgentSpawnActivity, AgentCompleteActivity } from '../../../../shared/types';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('lucide-react', () => ({
  Activity: () => <div data-testid="icon-activity" />,
  ChevronDown: () => <div data-testid="icon-chevron-down" />,
  ChevronUp: () => <div data-testid="icon-chevron-up" />,
  ArrowDownRight: () => <div data-testid="icon-arrow-down-right" />,
  Check: () => <div data-testid="icon-check" />,
  X: () => <div data-testid="icon-x" />,
}));

type Entry = AgentSpawnActivity | AgentCompleteActivity;

describe('ActivityStream UX', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Badge Feature', () => {
    it('renders count badge with correct number', () => {
      renderStream([mockSpawn, mockComplete]);

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders header when collapsed', () => {
      renderStream([mockSpawn]);

      expect(screen.getByText('Activity')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('renders header when expanded', () => {
      renderStream([mockSpawn]);
      expandStream();

      expect(screen.getByText('Activity')).toBeInTheDocument();
    });

    it('renders correct count with multiple entries', () => {
      const entries: Entry[] = [
        { ...mockSpawn, id: 'spawn-1' },
        { ...mockSpawn, id: 'spawn-2', spawnedAgentName: 'explore' },
        { ...mockComplete, id: 'complete-1' },
      ];
      renderStream(entries);

      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Scroll and Jump Button', () => {
    it('scroll container exists when expanded', () => {
      renderStream([mockSpawn]);
      expandStream();

      const logRegion = screen.getByRole('log');
      expect(logRegion).toBeInTheDocument();
    });

    it('aria-live region exists for screen readers', () => {
      renderStream([mockSpawn]);
      expandStream();

      const logRegion = screen.getByRole('log');
      expect(logRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('scroll container has overflow-y-auto', () => {
      renderStream([mockSpawn]);
      expandStream();

      const logRegion = screen.getByRole('log');
      expect(logRegion).toHaveClass('overflow-y-auto');
    });

    it('scroll event fires without errors', () => {
      renderStream([mockSpawn]);
      expandStream();

      const logRegion = screen.getByRole('log');
      expect(() => {
        fireEvent.scroll(logRegion);
      }).not.toThrow();
    });
  });

  describe('Collapse/Expand', () => {
    it('starts collapsed', () => {
      renderStream([mockSpawn]);

      expect(screen.queryByRole('log')).not.toBeInTheDocument();
    });

    it('toggle expands the stream', () => {
      renderStream([mockSpawn]);
      expandStream();

      expect(screen.getByRole('log')).toBeInTheDocument();
    });

    it('double toggle returns to collapsed', () => {
      renderStream([mockSpawn]);
      expandStream();
      expandStream();

      expect(screen.queryByRole('log')).not.toBeInTheDocument();
    });

    it('header persists across toggle states', () => {
      renderStream([mockSpawn]);

      expect(screen.getByText('Activity')).toBeInTheDocument();
      expandStream();
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('renders header with activity icon', () => {
      renderStream([mockSpawn]);

      expect(screen.getAllByTestId('icon-activity')[0]).toBeInTheDocument();
    });

    it('renders chevron icon', () => {
      renderStream([mockSpawn]);

      const hasChevron = screen.queryByTestId('icon-chevron-up') || screen.queryByTestId('icon-chevron-down');
      expect(hasChevron).toBeInTheDocument();
    });

    it('renders entries when expanded', () => {
      renderStream([mockSpawn]);
      expandStream();

      expect(screen.getByText('librarian')).toBeInTheDocument();
    });

    it('handles empty entries', () => {
      renderStream([]);
      expandStream();

      expect(screen.getByText('No activity yet')).toBeInTheDocument();
    });

    it('renders multiple entries correctly', () => {
      const entries: Entry[] = Array.from({ length: 5 }, (_, i) => ({
        ...mockSpawn,
        id: `spawn-${i}`,
        spawnedAgentName: `agent-${i}`,
      }));

      renderStream(entries);

      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });
});
