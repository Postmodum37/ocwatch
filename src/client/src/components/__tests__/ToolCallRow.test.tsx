import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCallRow } from '../ToolCallRow';
import type { ToolCallSummary } from '../../../../shared/types';
import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

vi.mock('lucide-react', () => ({
  ChevronDown: () => <div data-testid="icon-chevron-down" />,
  ChevronRight: () => <div data-testid="icon-chevron-right" />,
  Check: () => <div data-testid="icon-check" />,
  Loader2: () => <div data-testid="icon-loader" />,
  AlertCircle: () => <div data-testid="icon-alert" />,
}));

describe('ToolCallRow', () => {
  const mockToolCall: ToolCallSummary = {
    id: 'tool-1',
    name: 'mcp_bash',
    state: 'complete',
    summary: 'Run bash command: ls -la',
    input: {
      command: 'ls -la',
      description: 'List files',
    },
    timestamp: new Date().toISOString(),
    agentName: 'sisyphus',
  };

  it('renders tool name and summary', () => {
    render(<ToolCallRow toolCall={mockToolCall} />);

    expect(screen.getByText('mcp_bash')).toBeInTheDocument();
    expect(screen.getByText('Run bash command: ls -la')).toBeInTheDocument();
  });

  it('shows correct status badge for pending state', () => {
    const pendingToolCall: ToolCallSummary = {
      ...mockToolCall,
      state: 'pending',
    };

    render(<ToolCallRow toolCall={pendingToolCall} />);

    expect(screen.getByTestId('status-pending')).toBeInTheDocument();
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
  });

  it('shows correct status badge for complete state', () => {
    render(<ToolCallRow toolCall={mockToolCall} />);

    expect(screen.getByTestId('status-complete')).toBeInTheDocument();
    expect(screen.getByTestId('icon-check')).toBeInTheDocument();
  });

  it('shows correct status badge for error state', () => {
    const errorToolCall: ToolCallSummary = {
      ...mockToolCall,
      state: 'error',
    };

    render(<ToolCallRow toolCall={errorToolCall} />);

    expect(screen.getByTestId('status-error')).toBeInTheDocument();
    expect(screen.getByTestId('icon-alert')).toBeInTheDocument();
  });

  it('expands to show full arguments on click', () => {
    render(<ToolCallRow toolCall={mockToolCall} />);

    const expandButton = screen.getByTestId('tool-call-row-expand');
    fireEvent.click(expandButton);

    expect(screen.getByTestId('tool-call-arguments')).toBeInTheDocument();
    expect(screen.getByText('command')).toBeInTheDocument();
    expect(screen.getByText('ls -la')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByText('List files')).toBeInTheDocument();
  });

  it('collapses arguments on second click', () => {
    render(<ToolCallRow toolCall={mockToolCall} />);

    const expandButton = screen.getByTestId('tool-call-row-expand');
    
    // First click to expand
    fireEvent.click(expandButton);
    expect(screen.getByTestId('tool-call-arguments')).toBeInTheDocument();

    // Second click to collapse
    fireEvent.click(expandButton);
    expect(screen.queryByTestId('tool-call-arguments')).not.toBeInTheDocument();
  });

  it('shows chevron-right when collapsed', () => {
    render(<ToolCallRow toolCall={mockToolCall} />);

    expect(screen.getByTestId('icon-chevron-right')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-chevron-down')).not.toBeInTheDocument();
  });

  it('shows chevron-down when expanded', () => {
    render(<ToolCallRow toolCall={mockToolCall} />);

    const expandButton = screen.getByTestId('tool-call-row-expand');
    fireEvent.click(expandButton);

    expect(screen.getByTestId('icon-chevron-down')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-chevron-right')).not.toBeInTheDocument();
  });

  it('displays timestamp in relative format', () => {
    render(<ToolCallRow toolCall={mockToolCall} />);

    // Should display relative time (e.g., "just now", "5m ago", etc.)
    const timeElement = screen.getByTestId('tool-call-timestamp');
    expect(timeElement).toBeInTheDocument();
    expect(timeElement.textContent).toMatch(/ago|now/);
  });

  it('handles tool calls with complex nested input objects', () => {
    const complexToolCall: ToolCallSummary = {
      ...mockToolCall,
      input: {
        filePath: '/path/to/file',
        options: {
          recursive: true,
          depth: 3,
        },
        filters: ['*.ts', '*.tsx'],
      },
    };

    render(<ToolCallRow toolCall={complexToolCall} />);

    const expandButton = screen.getByTestId('tool-call-row-expand');
    fireEvent.click(expandButton);

    expect(screen.getByText('filePath')).toBeInTheDocument();
    expect(screen.getByText('/path/to/file')).toBeInTheDocument();
    expect(screen.getByText('options')).toBeInTheDocument();
  });

  it('handles tool calls with empty input object', () => {
    const emptyInputToolCall: ToolCallSummary = {
      ...mockToolCall,
      input: {},
    };

    render(<ToolCallRow toolCall={emptyInputToolCall} />);

    const expandButton = screen.getByTestId('tool-call-row-expand');
    fireEvent.click(expandButton);

    expect(screen.getByTestId('tool-call-arguments')).toBeInTheDocument();
  });
});
