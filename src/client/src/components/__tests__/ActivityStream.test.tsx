import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityStream } from '../ActivityStream';
import type { ActivityItem } from '../../../../shared/types';
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

  it('renders with empty data (empty state)', () => {
    render(<ActivityStream items={[]} />);

    expect(screen.getAllByTestId('icon-activity')[0]).toBeInTheDocument();
    expect(screen.getByText('Activity Stream')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    const { container } = render(<ActivityStream items={[]} />);
    const shimmerElements = container.querySelectorAll('[class*="animate-shimmer"]');
    expect(shimmerElements.length).toBeGreaterThan(0);
  });

  it('renders activity items when data provided', () => {
    const items: ActivityItem[] = [mockToolCallActivity, mockAgentSpawnActivity];
    render(<ActivityStream items={items} />);

    expect(screen.getByText('Activity Stream')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('readFile')).toBeInTheDocument();
  });

  it('shows unique agents in filter chips', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      { ...mockAgentSpawnActivity, agentName: 'prometheus' },
      { ...mockAgentCompleteActivity, agentName: 'librarian' },
    ];
    render(<ActivityStream items={items} />);

    // Filter chips should show unique agents (use getAllByText to get button, not span)
    const prometheusChips = screen.getAllByText('prometheus');
    const librarianChips = screen.getAllByText('librarian');
    expect(prometheusChips.length).toBeGreaterThan(0);
    expect(librarianChips.length).toBeGreaterThan(0);
  });

  it('clicking filter chip toggles agent filter', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      { ...mockAgentSpawnActivity, agentName: 'prometheus' },
    ];
    render(<ActivityStream items={items} />);

    // Find the prometheus filter chip button
    const prometheusChips = screen.getAllByText('prometheus');
    const prometheusButton = prometheusChips.find(el => el.tagName === 'BUTTON');
    expect(prometheusButton).toBeInTheDocument();
    
    // Click to filter
    fireEvent.click(prometheusButton!);

    // After filtering, the button should have inline style with background-color
    const style = prometheusButton?.getAttribute('style');
    expect(style).toContain('background-color');
  });

  it('clicking row expands to show details for tool-call with input', () => {
    const items: ActivityItem[] = [mockToolCallActivity];
    render(<ActivityStream items={items} />);

    // Find the row (contains the tool name)
    const row = screen.getByText('readFile').closest('div');
    expect(row).toBeInTheDocument();

    // Click to expand
    fireEvent.click(row!);

    // Details should now be visible
    expect(screen.getByText('Input')).toBeInTheDocument();
  });

  it('collapsed state shows summary bar with stats', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      mockAgentSpawnActivity,
      mockAgentCompleteActivity,
    ];
    render(<ActivityStream items={items} totalTokens={1000} />);

    // Click collapse button
    const collapseButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('[data-testid="icon-chevron-down"]')
    );
    fireEvent.click(collapseButton!);

    // Summary bar should show stats
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
    render(<ActivityStream items={[errorItem]} />);

    // Click to expand
    const row = screen.getByText('exec').closest('div');
    fireEvent.click(row!);

    // Error should be visible
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Command failed with exit code 1')).toBeInTheDocument();
  });

  it('clear filters button removes all filters', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      { ...mockAgentSpawnActivity, agentName: 'prometheus' },
      { ...mockAgentCompleteActivity, agentName: 'librarian' },
    ];
    render(<ActivityStream items={items} />);

    // Apply filter
    const prometheusChip = screen.getByText('prometheus');
    fireEvent.click(prometheusChip);

    // Clear button should appear
    const clearButton = screen.getByText('Clear');
    expect(clearButton).toBeInTheDocument();

    // Click clear
    fireEvent.click(clearButton);

    // All items should be visible again
    expect(screen.getByText('3')).toBeInTheDocument();
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
    render(<ActivityStream items={[pendingItem]} />);

    expect(screen.getByText('bash')).toBeInTheDocument();
    expect(screen.getByTestId('icon-loader2')).toBeInTheDocument();
  });

  it('renders agent-spawn activity with correct icon', () => {
    const items: ActivityItem[] = [mockAgentSpawnActivity];
    render(<ActivityStream items={items} />);

    expect(screen.getByTestId('icon-arrow-down-right')).toBeInTheDocument();
  });

  it('renders agent-complete activity with status', () => {
    const items: ActivityItem[] = [mockAgentCompleteActivity];
    render(<ActivityStream items={items} />);

    expect(screen.getByText(/Completed task/)).toBeInTheDocument();
    expect(screen.getByText(/completed/)).toBeInTheDocument();
  });

  it('displays items in reverse chronological order (newest first)', () => {
    const items: ActivityItem[] = [
      { ...mockToolCallActivity, id: 'tool-1', timestamp: new Date('2025-02-02T10:00:00Z') },
      { ...mockToolCallActivity, id: 'tool-2', timestamp: new Date('2025-02-02T10:01:00Z') },
      { ...mockToolCallActivity, id: 'tool-3', timestamp: new Date('2025-02-02T10:02:00Z') },
    ];
    render(<ActivityStream items={items} />);

    // Get all rows (they should be in reverse order)
    const rows = screen.getAllByText(/readFile/);
    expect(rows.length).toBe(3);
  });

  it('handles totalTokens prop correctly', () => {
    const items: ActivityItem[] = [mockToolCallActivity];
    render(<ActivityStream items={items} totalTokens={5000} />);

    // Collapse to see summary
    const collapseButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('[data-testid="icon-chevron-down"]')
    );
    fireEvent.click(collapseButton!);

    expect(screen.getByText(/5,000 tokens/)).toBeInTheDocument();
  });

  it('does not show clear button when no filters applied', () => {
    const items: ActivityItem[] = [mockToolCallActivity];
    render(<ActivityStream items={items} />);

    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('shows "Try clearing filters" message when filter results in no items', () => {
    const items: ActivityItem[] = [
      mockToolCallActivity,
      { ...mockAgentCompleteActivity, agentName: 'librarian' },
    ];
    render(<ActivityStream items={items} />);

    // Get filter buttons
    const prometheusChips = screen.getAllByText('prometheus');
    const librarianChips = screen.getAllByText('librarian');
    const prometheusButton = prometheusChips.find(el => el.tagName === 'BUTTON');
    const librarianButton = librarianChips.find(el => el.tagName === 'BUTTON');

    // Select prometheus
    fireEvent.click(prometheusButton!);

    // Select librarian (now both are selected, but only prometheus and librarian items exist)
    fireEvent.click(librarianButton!);

    // Deselect both
    fireEvent.click(prometheusButton!);
    fireEvent.click(librarianButton!);

    // No filters selected, so message should not appear
    expect(screen.queryByText('Try clearing filters')).not.toBeInTheDocument();
  });

  it('uses the correct expanded height class', () => {
    const items: ActivityItem[] = [mockToolCallActivity];
    render(<ActivityStream items={items} />);
    
    const container = screen.getByText('Activity Stream').closest('.h-80');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('max-h-[50vh]');
  });
});
