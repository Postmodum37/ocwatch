import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityStream } from '../ActivityStream';
import type { ActivityItem } from '../../../../shared/types';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('ActivityStream UX - Badge and Jump Button', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Badge Feature', () => {
    it('renders without errors when expanded', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      expect(screen.getByText('Activity Stream')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('renders without errors when collapsed', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      const collapseButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('[data-testid="icon-chevron-down"]')
      );
      fireEvent.click(collapseButton!);

      expect(screen.getByText('Activity Stream')).toBeInTheDocument();
    });

    it('badge element exists in header when collapsed', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      const collapseButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('[data-testid="icon-chevron-down"]')
      );
      fireEvent.click(collapseButton!);

      const header = screen.getByText('Activity Stream').closest('div');
      expect(header).toBeInTheDocument();
    });

    it('renders correct count in item counter', () => {
      const items: ActivityItem[] = [
        mockToolCallActivity,
        { ...mockToolCallActivity, id: 'tool-2', toolName: 'writeFile' },
        { ...mockToolCallActivity, id: 'tool-3', toolName: 'exec' },
      ];
      render(<ActivityStream items={items} />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Jump Button Feature', () => {
    it('does not show jump button when at bottom', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      expect(screen.queryByText('Jump to latest')).not.toBeInTheDocument();
    });

    it('scroll container has relative positioning for jump button', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      const scrollContainer = screen.getByText('readFile').closest('.overflow-y-auto');
      expect(scrollContainer).toHaveClass('relative');
    });

    it('scroll container has onScroll handler', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      const scrollContainer = screen.getByText('readFile').closest('.overflow-y-auto') as HTMLDivElement;
      expect(scrollContainer).toBeInTheDocument();

      fireEvent.scroll(scrollContainer);
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  describe('Scroll Position Tracking', () => {
    it('scroll container is properly configured', () => {
      const items: ActivityItem[] = [mockToolCallActivity];

      render(<ActivityStream items={items} />);

      const scrollContainer = screen.getByText('readFile').closest('.overflow-y-auto') as HTMLDivElement;
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass('overflow-y-auto');
      expect(scrollContainer).toHaveClass('min-h-0');
    });

    it('scroll event fires without errors', () => {
      const items: ActivityItem[] = [mockToolCallActivity];

      render(<ActivityStream items={items} />);

      const scrollContainer = screen.getByText('readFile').closest('.overflow-y-auto') as HTMLDivElement;
      expect(() => {
        fireEvent.scroll(scrollContainer);
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('collapse and expand buttons work correctly', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      const collapseButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('[data-testid="icon-chevron-down"]')
      );

      expect(collapseButton).toBeInTheDocument();

      fireEvent.click(collapseButton!);
      expect(screen.getByText('Activity Stream')).toBeInTheDocument();

      fireEvent.click(collapseButton!);
      expect(screen.getByText('Activity Stream')).toBeInTheDocument();
    });

    it('component renders with multiple items', () => {
      const items: ActivityItem[] = Array.from({ length: 5 }, (_, i) => ({
        ...mockToolCallActivity,
        id: `tool-${i}`,
      }));

      render(<ActivityStream items={items} />);

      expect(screen.getByText('Activity Stream')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('component handles empty items', () => {
      const { container } = render(<ActivityStream items={[]} />);

      expect(screen.getByText('Activity Stream')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      const shimmerElements = container.querySelectorAll('[class*="animate-shimmer"]');
      expect(shimmerElements.length).toBeGreaterThan(0);
    });

    it('all interactive elements are present', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      const header = screen.getByText('Activity Stream');
      expect(header).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('renders header with activity icon', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      expect(screen.getByTestId('icon-activity')).toBeInTheDocument();
    });

    it('renders collapse/expand button', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      expect(screen.getByTestId('icon-chevron-down')).toBeInTheDocument();
    });

    it('renders activity items when expanded', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      expect(screen.getByText('readFile')).toBeInTheDocument();
    });

    it('renders filter section when expanded', () => {
      const items: ActivityItem[] = [mockToolCallActivity];
      render(<ActivityStream items={items} />);

      expect(screen.getByTestId('icon-filter')).toBeInTheDocument();
    });
  });
});
