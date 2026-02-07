import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityStream } from '../ActivityStream';
import type { ActivityItem } from '../../../../shared/types';
import { groupIntoBursts } from '../../../../shared/utils/burstGrouping';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Activity: () => <div data-testid="icon-activity" />,
  ChevronDown: () => <div data-testid="icon-chevron-down" />,
  ChevronUp: () => <div data-testid="icon-chevron-up" />,
  Filter: () => <div data-testid="icon-filter" />,
  X: () => <div data-testid="icon-x" />,
  Terminal: () => <div data-testid="icon-terminal" />,
  FileText: () => <div data-testid="icon-file-text" />,
  FileEdit: () => <div data-testid="icon-file-edit" />,
  Search: () => <div data-testid="icon-search" />,
  Globe: () => <div data-testid="icon-globe" />,
  ArrowDownRight: () => <div data-testid="icon-arrow-down-right" />,
  Check: () => <div data-testid="icon-check" />,
  ChevronRight: () => <div data-testid="icon-chevron-right" />,
  Loader2: () => <div data-testid="icon-loader2" />,
  Circle: () => <div data-testid="icon-circle" />,
  AlertCircle: () => <div data-testid="icon-alert-circle" />,
  LayoutList: () => <div data-testid="icon-layout-list" />,
  Users: () => <div data-testid="icon-users" />,
  Diamond: () => <div data-testid="icon-diamond" />,
}));

describe('ActivityStream', () => {
  const mockToolCallActivity: ActivityItem = {
    id: 'tool-1',
    type: 'tool-call',
    timestamp: new Date('2025-02-02T10:00:00Z'),
    agentName: 'prometheus',
    toolName: 'readFile',
    state: 'complete',
    summary: 'Read package.json',
    input: { filePath: 'package.json' },
  };

  const mockAgentSpawnActivity: ActivityItem = {
    id: 'spawn-1',
    type: 'agent-spawn',
    timestamp: new Date('2025-02-02T10:01:00Z'),
    agentName: 'prometheus',
    spawnedAgentName: 'librarian',
  };

  const mockAgentCompleteActivity: ActivityItem = {
    id: 'complete-1',
    type: 'agent-complete',
    timestamp: new Date('2025-02-02T10:02:00Z'),
    agentName: 'librarian',
    status: 'completed',
    durationMs: 5000,
  };

  const renderStream = (items: ActivityItem[], props = {}) => {
    const entries = groupIntoBursts(items);
    return render(<ActivityStream entries={entries} {...props} />);
  };

  it('renders with empty data (empty state)', () => {
    renderStream([]);

    expect(screen.getAllByTestId('icon-activity')[0]).toBeInTheDocument();
    expect(screen.getByText('Activity Stream')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('renders activity items when data provided', () => {
    const items: ActivityItem[] = [mockToolCallActivity, mockAgentSpawnActivity];
    renderStream(items);

    expect(screen.getByText('Activity Stream')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/readFile/)).toBeInTheDocument();
  });

  it('shows unique agents in filter chips', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      { ...mockToolCallActivity, id: 'tool-2', agentName: 'prometheus' },
      { ...mockAgentCompleteActivity, agentName: 'librarian' },
    ];
    renderStream(items);

    const prometheusChips = screen.getAllByText('prometheus');
    const librarianChips = screen.getAllByText('librarian');
    expect(prometheusChips.length).toBeGreaterThan(0);
    expect(librarianChips.length).toBeGreaterThan(0);
  });

  it('clicking filter chip toggles agent filter', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      { ...mockToolCallActivity, id: 'tool-2', agentName: 'prometheus' },
    ];
    renderStream(items);

    const prometheusChips = screen.getAllByText('prometheus');
    const prometheusButton = prometheusChips.find(el => el.tagName === 'BUTTON');
    expect(prometheusButton).toBeInTheDocument();
    
    fireEvent.click(prometheusButton!);

    const style = prometheusButton?.getAttribute('style');
    expect(style).toContain('background-color');
  });

  it('clicking burst row expands to show details', () => {
    const items: ActivityItem[] = [mockToolCallActivity];
    renderStream(items);

    const burstRowButton = screen.getByTestId('burst-row').querySelector('button');
    fireEvent.click(burstRowButton!);

    // Expect summary text and expanded row text
    expect(screen.getAllByText('Read package.json')).toHaveLength(2);
  });

  it('collapsed state shows summary bar with stats', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      mockAgentSpawnActivity,
      mockAgentCompleteActivity,
    ];
    renderStream(items, { totalTokens: 1000 });

    const collapseButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('[data-testid="icon-chevron-down"]')
    );
    fireEvent.click(collapseButton!);

    expect(screen.getByText(/calls/)).toBeInTheDocument();
    expect(screen.getByText(/agents/)).toBeInTheDocument();
    expect(screen.getByText(/tokens/)).toBeInTheDocument();
  });

  it('displays error details when tool-call has error', () => {
    const errorItem: ActivityItem = {
      id: 'tool-error',
      type: 'tool-call',
      timestamp: new Date(),
      agentName: 'prometheus',
      toolName: 'exec',
      state: 'error',
      input: {},
      error: 'Command failed with exit code 1',
    };
    renderStream([errorItem]);

    expect(screen.getByTestId('burst-row')).toBeInTheDocument();
    expect(screen.getByText('1 error')).toBeInTheDocument();
    expect(screen.getByText('Command failed with exit code 1')).toBeInTheDocument();
  });

  it('clear filters button removes all filters', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      { ...mockToolCallActivity, id: 'tool-2', agentName: 'prometheus' },
      { ...mockAgentCompleteActivity, agentName: 'librarian' },
    ];
    renderStream(items);

    const prometheusChips = screen.getAllByText('prometheus');
    const prometheusChip = prometheusChips.find(el => el.tagName === 'BUTTON');
    fireEvent.click(prometheusChip!);

    const clearButton = screen.getByText('Clear');
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders pending tool-call with spinner icon', () => {
    const pendingItem: ActivityItem = {
      id: 'tool-pending',
      type: 'tool-call',
      timestamp: new Date(),
      agentName: 'prometheus',
      toolName: 'bash',
      state: 'pending',
      input: {},
    };
    renderStream([pendingItem]);

    expect(screen.getAllByText(/bash/)[0]).toBeInTheDocument();
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();
  });

  it('renders agent-spawn activity with correct icon', () => {
    const items: ActivityItem[] = [mockAgentSpawnActivity];
    renderStream(items);

    expect(screen.getByTestId('milestone-spawn')).toBeInTheDocument();
    expect(screen.getByTestId('icon-arrow-down-right')).toBeInTheDocument();
  });

  it('renders agent-complete activity with status', () => {
    const items: ActivityItem[] = [mockAgentCompleteActivity];
    renderStream(items);

    expect(screen.getByTestId('milestone-complete')).toBeInTheDocument();
    expect(screen.getByText(/completed/)).toBeInTheDocument();
  });

  it('displays items in reverse chronological order (grouped by burst)', () => {
    const items: ActivityItem[] = [
      { ...mockToolCallActivity, id: 'tool-1', timestamp: new Date('2025-02-02T10:00:00Z') },
      { ...mockToolCallActivity, id: 'tool-2', timestamp: new Date('2025-02-02T10:01:00Z') },
      { ...mockToolCallActivity, id: 'tool-3', timestamp: new Date('2025-02-02T10:02:00Z') },
    ];
    renderStream(items);

    const rows = screen.getAllByText(/readFile/);
    expect(rows.length).toBe(1); 
    expect(screen.getByText(/readFile ×3/)).toBeInTheDocument();
  });

  it('handles totalTokens prop correctly', () => {
    const items: ActivityItem[] = [mockToolCallActivity];
    renderStream(items, { totalTokens: 5000 });

    const collapseButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('[data-testid="icon-chevron-down"]')
    );
    fireEvent.click(collapseButton!);

    expect(screen.getByText(/5,000 tokens/)).toBeInTheDocument();
  });

  it('does not show clear button when no filters applied', () => {
    const items: ActivityItem[] = [mockToolCallActivity];
    renderStream(items);

    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('shows all items when all filters are toggled off', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      { ...mockAgentCompleteActivity, agentName: 'librarian' },
    ];
    renderStream(items);

    const prometheusChips = screen.getAllByText('prometheus');
    const librarianChips = screen.getAllByText('librarian');
    const prometheusButton = prometheusChips.find(el => el.tagName === 'BUTTON');
    const librarianButton = librarianChips.find(el => el.tagName === 'BUTTON');

    fireEvent.click(prometheusButton!);
    fireEvent.click(librarianButton!);
    fireEvent.click(prometheusButton!);
    fireEvent.click(librarianButton!);

    expect(screen.queryByText('No activity yet')).not.toBeInTheDocument();
  });

  it('uses the correct expanded height class', () => {
    const items: ActivityItem[] = [mockToolCallActivity];
    renderStream(items);
    
    const container = screen.getByText('Activity Stream').closest('.h-80');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('max-h-[50vh]');
  });

  describe('Burst Row Features', () => {
    it('renders burst row in collapsed state by default', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      renderStream(items);

      expect(screen.getByTestId('burst-row')).toBeInTheDocument();
      expect(screen.getByText(/readFile ×1/)).toBeInTheDocument();
    });

  it('expands burst row to show individual tool calls', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      { ...mockToolCallActivity, id: 'tool-2', summary: 'Read tsconfig.json' },
    ];
    renderStream(items);

    const burstRowButton = screen.getByTestId('burst-row').querySelector('button');
    fireEvent.click(burstRowButton!);

    expect(screen.getByText('Read package.json')).toBeInTheDocument();
    expect(screen.getAllByText('Read tsconfig.json')).toHaveLength(2);
  });

    it('shows tool breakdown in burst summary', () => {
      const items: ActivityItem[] = [
        mockToolCallActivity,
        { ...mockToolCallActivity, id: 'tool-2', toolName: 'writeFile' },
        { ...mockToolCallActivity, id: 'tool-3', toolName: 'writeFile' },
      ];
      renderStream(items);

      expect(screen.getByText(/readFile ×1, writeFile ×2/)).toBeInTheDocument();
    });

    it('shows error indicator on burst with errors', () => {
      const items: ActivityItem[] = [
        mockToolCallActivity,
        { ...mockToolCallActivity, id: 'tool-error', state: 'error', error: 'Failed' },
      ];
      renderStream(items);

      expect(screen.getByTestId('icon-alert-circle')).toBeInTheDocument();
    });

    it('shows pending indicator on burst with pending calls', () => {
      const items: ActivityItem[] = [
        mockToolCallActivity,
        { ...mockToolCallActivity, id: 'tool-pending', state: 'pending' },
      ];
      renderStream(items);

      expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();
    });

    it('displays burst duration', () => {
      const items: ActivityItem[] = [
        { ...mockToolCallActivity, timestamp: new Date('2025-02-02T10:00:00Z') },
        { ...mockToolCallActivity, id: 'tool-2', timestamp: new Date('2025-02-02T10:00:05Z') },
      ];
      renderStream(items);

      expect(screen.getByText(/5s/)).toBeInTheDocument();
    });
  });

  describe('Milestone Features', () => {
    it('renders milestone entries with visual distinction', () => {
      const items: ActivityItem[] = [
        mockAgentSpawnActivity,
        mockAgentCompleteActivity,
      ];
      renderStream(items);

      expect(screen.getByTestId('milestone-spawn')).toBeInTheDocument();
      expect(screen.getByTestId('milestone-complete')).toBeInTheDocument();
    });

    it('shows spawned agent name in milestone', () => {
      const items: ActivityItem[] = [mockAgentSpawnActivity];
      renderStream(items);

      expect(screen.getByText('librarian')).toBeInTheDocument();
      expect(screen.getByText(/from prometheus/)).toBeInTheDocument();
    });
  });

  describe('Tab Toggle Features', () => {
    it('renders Stream and Agents tabs when expanded', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      renderStream(items);

      expect(screen.getByText('Stream')).toBeInTheDocument();
      expect(screen.getByText('Agents')).toBeInTheDocument();
    });

    it('switches to Agents tab on click', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      renderStream(items);

      const agentsTab = screen.getByText('Agents');
      fireEvent.click(agentsTab);

      const agentsButton = agentsTab.closest('button');
      expect(agentsButton).toHaveClass('border-accent');
      expect(agentsButton).toHaveClass('text-accent');
    });

    it('Stream tab is active by default', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      renderStream(items);

      const streamTab = screen.getByText('Stream').closest('button');
      expect(streamTab).toHaveClass('border-accent');
      expect(streamTab).toHaveClass('text-accent');
    });

    it('does not show tabs when collapsed', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      renderStream(items);

      const collapseButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('[data-testid="icon-chevron-down"]')
      );
      fireEvent.click(collapseButton!);

      expect(screen.queryByText('Stream')).not.toBeInTheDocument();
      expect(screen.queryByText('Agents')).not.toBeInTheDocument();
    });
  });
});
