import { render, screen, within, fireEvent } from '@testing-library/react';
import { AgentSwimlane } from '../AgentSwimlane';
import type { ActivityItem } from '../../../../shared/types';
import { groupIntoBursts } from '../../../../shared/utils/burstGrouping';
import { describe, it, expect, vi } from 'vitest';

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

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

const mockToolCall = (id: string, agent: string, tool = 'readFile'): ActivityItem => ({
  id,
  type: 'tool-call',
  timestamp: new Date('2025-02-02T10:00:00Z'),
  agentName: agent,
  toolName: tool,
  state: 'complete',
  summary: `${tool} summary`,
  input: { filePath: 'test.ts' },
});

const mockSpawn = (id: string, from: string, spawned: string): ActivityItem => ({
  id,
  type: 'agent-spawn',
  timestamp: new Date('2025-02-02T10:01:00Z'),
  agentName: from,
  spawnedAgentName: spawned,
});

const mockComplete = (id: string, agent: string, status: 'completed' | 'idle' = 'completed'): ActivityItem => ({
  id,
  type: 'agent-complete',
  timestamp: new Date('2025-02-02T10:02:00Z'),
  agentName: agent,
  status,
  durationMs: 5000,
});

const renderSwimlane = (items: ActivityItem[]) => {
  const entries = groupIntoBursts(items);
  return render(<AgentSwimlane entries={entries} />);
};

describe('AgentSwimlane', () => {
  it('renders "No agents yet" with empty entries', () => {
    renderSwimlane([]);

    expect(screen.getByText('No agents yet')).toBeInTheDocument();
  });

  it('renders agent columns for each unique agent', () => {
    renderSwimlane([
      mockToolCall('tc-1', 'prometheus', 'readFile'),
      mockToolCall('tc-2', 'prometheus', 'writeFile'),
      mockToolCall('tc-3', 'librarian', 'readFile'),
    ]);

    expect(screen.getByText('prometheus')).toBeInTheDocument();
    expect(screen.getByText('librarian')).toBeInTheDocument();
    expect(screen.getAllByTestId('swimlane-column')).toHaveLength(2);
  });

  it('shows agent name in column header with correct color', () => {
    renderSwimlane([
      mockToolCall('tc-1', 'prometheus'),
      mockToolCall('tc-2', 'prometheus'),
    ]);

    const agentName = screen.getByText('prometheus');
    const style = agentName.getAttribute('style') ?? '';

    expect(style).toMatch(/a855f7|168,\s*85,\s*247/i);
  });

  it('shows completion icon (Check) for completed agents', () => {
    renderSwimlane([
      mockToolCall('tc-1', 'prometheus'),
      mockToolCall('tc-2', 'prometheus'),
      mockComplete('complete-1', 'prometheus', 'completed'),
    ]);

    const headerRow = screen.getByText('prometheus').closest('div');
    expect(headerRow).toBeInTheDocument();
    expect(within(headerRow as HTMLElement).getByTestId('icon-check')).toBeInTheDocument();
  });

  it('shows error icon (X) for errored agents', () => {
    renderSwimlane([
      mockToolCall('tc-1', 'prometheus'),
      mockToolCall('tc-2', 'prometheus'),
      mockComplete('complete-1', 'prometheus', 'idle'),
    ]);

    const headerRow = screen.getByText('prometheus').closest('div');
    expect(headerRow).toBeInTheDocument();
    expect(within(headerRow as HTMLElement).getByTestId('icon-x')).toBeInTheDocument();
  });

  it('renders burst entries within agent column (tool breakdown text)', () => {
    renderSwimlane([
      mockToolCall('tc-1', 'prometheus', 'readFile'),
      mockToolCall('tc-2', 'prometheus', 'readFile'),
      mockToolCall('tc-3', 'prometheus', 'writeFile'),
      mockSpawn('s-1', 'prometheus', 'librarian'),
    ]);

    expect(screen.getByText(/readFile ×2, writeFile ×1|writeFile ×1, readFile ×2/)).toBeInTheDocument();
  });

  it('renders milestone spawn entries', () => {
    renderSwimlane([
      mockToolCall('tc-1', 'prometheus'),
      mockToolCall('tc-2', 'prometheus'),
      mockSpawn('spawn-1', 'prometheus', 'librarian'),
    ]);

    expect(screen.getByText('librarian')).toBeInTheDocument();
  });

  it('renders milestone completion entries', () => {
    renderSwimlane([
      mockToolCall('tc-1', 'prometheus'),
      mockToolCall('tc-2', 'prometheus'),
      mockComplete('complete-1', 'prometheus', 'completed'),
    ]);

    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('5s')).toBeInTheDocument();
  });

  it('renders error tool calls in bursts', () => {
    const errorToolCall: ActivityItem = {
      id: 'tc-error',
      type: 'tool-call',
      timestamp: new Date('2025-02-02T10:00:00Z'),
      agentName: 'prometheus',
      toolName: 'exec',
      state: 'error',
      summary: 'exec summary',
      input: { filePath: 'test.ts' },
      error: 'Command failed',
    };

    renderSwimlane([
      errorToolCall,
      mockSpawn('s-1', 'prometheus', 'librarian'),
    ]);

    // Error tool call should be grouped in a burst (not a milestone)
    expect(screen.getByText(/exec ×1/)).toBeInTheDocument();
    expect(screen.getByTestId('icon-alert-circle')).toBeInTheDocument();
  });

  it('applies reduced opacity to completed agent columns', () => {
    renderSwimlane([
      mockToolCall('tc-1', 'prometheus'),
      mockToolCall('tc-2', 'prometheus'),
      mockComplete('complete-1', 'prometheus', 'completed'),
    ]);

    const completedColumn = screen.getAllByTestId('swimlane-column').find(
      el => el.classList.contains('opacity-60')
    );
    expect(completedColumn).toBeInTheDocument();
  });

  describe('Sort Order', () => {
    it('sorts active agents before completed agents', () => {
      renderSwimlane([
        mockToolCall('tc-1', 'alpha'),
        mockToolCall('tc-2', 'alpha'),
        mockComplete('c-1', 'alpha', 'completed'),
        mockToolCall('tc-3', 'zeta'),
        mockToolCall('tc-4', 'zeta'),
      ]);

      const columns = screen.getAllByTestId('swimlane-column');
      const firstAgent = within(columns[0]!).getByText('zeta');
      const secondAgent = within(columns[1]!).getByText('alpha');
      expect(firstAgent).toBeInTheDocument();
      expect(secondAgent).toBeInTheDocument();
    });

    it('sorts by entry count descending within same status', () => {
      renderSwimlane([
        // beta: 5 tool calls = 1 burst entry
        ...Array.from({ length: 5 }, (_, i) => mockToolCall(`b-${i}`, 'beta')),
        // alpha: 2 tool calls = 1 burst entry + 3 spawns = 4 total entries
        mockToolCall('a-1', 'alpha'),
        mockToolCall('a-2', 'alpha'),
        mockSpawn('s-1', 'alpha', 'x'),
        mockSpawn('s-2', 'alpha', 'y'),
        mockSpawn('s-3', 'alpha', 'z'),
      ]);

      const columns = screen.getAllByTestId('swimlane-column');
      // alpha has 4 entries (1 burst + 3 spawn milestones), beta has 1 entry (1 burst)
      const firstAgent = within(columns[0]!).getByText('alpha');
      expect(firstAgent).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('shows compact view for agents with 1 entry (single milestone)', () => {
      renderSwimlane([
        ...Array.from({ length: 3 }, (_, i) => mockToolCall(`p-${i}`, 'prometheus')),
        mockSpawn('s-1', 'prometheus', 'librarian'),
        mockComplete('c-1', 'librarian', 'completed'),
      ]);

      const compactButtons = screen.getAllByTestId('compact-expand');
      expect(compactButtons.length).toBeGreaterThan(0);
    });

    it('shows compact view for agents with exactly 1 entry', () => {
      renderSwimlane([
        ...Array.from({ length: 3 }, (_, i) => mockToolCall(`p-${i}`, 'prometheus')),
        mockSpawn('s-1', 'prometheus', 'librarian'),
        mockComplete('c-1', 'librarian', 'completed'),
      ]);

      expect(screen.getByText('1 event')).toBeInTheDocument();
    });

    it('expands compact agent on click', () => {
      renderSwimlane([
        ...Array.from({ length: 3 }, (_, i) => mockToolCall(`p-${i}`, 'prometheus')),
        mockSpawn('s-1', 'prometheus', 'librarian'),
        mockComplete('c-1', 'librarian', 'completed'),
      ]);

      const compactButton = screen.getByText('1 event').closest('button')!;
      fireEvent.click(compactButton);

      expect(screen.getByText('completed')).toBeInTheDocument();
    });

    it('shows entry count badge in header', () => {
      renderSwimlane([
        mockToolCall('tc-1', 'prometheus'),
        mockToolCall('tc-2', 'prometheus'),
        mockToolCall('tc-3', 'prometheus'),
      ]);

      // Entry count badge (1 burst entry from 3 tool calls)
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Flex Sizing', () => {
    it('uses high flex for agents with 5+ entries', () => {
      renderSwimlane([
        // 5 spawns from prometheus = 5 milestone entries
        ...Array.from({ length: 5 }, (_, i) =>
          mockSpawn(`s-${i}`, 'prometheus', `agent-${i}`)
        ),
        mockToolCall('tc-1', 'prometheus'),
      ]);

      const column = screen.getAllByTestId('swimlane-column').find(
        el => el.className.includes('flex-[2')
      );
      expect(column).toBeInTheDocument();
    });
  });
});
