import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActivityRow } from '../ActivityRow';
import type { ActivityItem } from '../../../../shared/types';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Terminal: () => <div data-testid="icon-terminal" />,
  FileText: () => <div data-testid="icon-file-text" />,
  FileEdit: () => <div data-testid="icon-file-edit" />,
  Search: () => <div data-testid="icon-search" />,
  Globe: () => <div data-testid="icon-globe" />,
  ArrowDownRight: () => <div data-testid="icon-arrow-down-right" />,
  Check: () => <div data-testid="icon-check" />,
  X: () => <div data-testid="icon-x" />,
  ChevronRight: () => <div data-testid="icon-chevron-right" />,
  ChevronDown: () => <div data-testid="icon-chevron-down" />,
  ChevronUp: () => <div data-testid="icon-chevron-up" />,
  Loader2: () => <div data-testid="icon-loader2" />,
  Circle: () => <div data-testid="icon-circle" />,
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ActivityRow', () => {
  const mockReadToolCall: ActivityItem = {
    id: 'tool-1',
    type: 'tool-call',
    timestamp: new Date('2025-02-02T10:00:00Z'),
    agentName: 'prometheus',
    toolName: 'mcp_read',
    state: 'complete',
    summary: 'Read package.json',
    input: { filePath: 'package.json' },
  };

  const mockWriteToolCall: ActivityItem = {
    id: 'tool-2',
    type: 'tool-call',
    timestamp: new Date('2025-02-02T10:01:00Z'),
    agentName: 'librarian',
    toolName: 'mcp_write',
    state: 'complete',
    summary: 'Write config',
    input: { filePath: 'tsconfig.json' },
  };

  const mockGrepToolCall: ActivityItem = {
    id: 'tool-3',
    type: 'tool-call',
    timestamp: new Date('2025-02-02T10:02:00Z'),
    agentName: 'prometheus',
    toolName: 'mcp_grep',
    state: 'complete',
    summary: 'Search pattern',
    input: { pattern: 'export function', path: 'src/' },
  };

  const mockBashToolCall: ActivityItem = {
    id: 'tool-4',
    type: 'tool-call',
    timestamp: new Date('2025-02-02T10:03:00Z'),
    agentName: 'prometheus',
    toolName: 'mcp_bash',
    state: 'complete',
    summary: 'Run command',
    input: { command: 'npm install', description: 'Install dependencies' },
  };

  const mockWebfetchToolCall: ActivityItem = {
    id: 'tool-5',
    type: 'tool-call',
    timestamp: new Date('2025-02-02T10:04:00Z'),
    agentName: 'librarian',
    toolName: 'mcp_webfetch',
    state: 'complete',
    summary: 'Fetch URL',
    input: { url: 'https://example.com' },
  };

  it('renders read tool call with filePath field prominently', () => {
    render(<ActivityRow item={mockReadToolCall} />);

    expect(screen.getByText('mcp_read')).toBeInTheDocument();

    const row = screen.getByText('mcp_read').closest('button');
    fireEvent.click(row!);

    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();
  });

  it('renders write tool call with filePath field', () => {
    render(<ActivityRow item={mockWriteToolCall} />);

    expect(screen.getByText('mcp_write')).toBeInTheDocument();

    const row = screen.getByText('mcp_write').closest('button');
    fireEvent.click(row!);

    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('tsconfig.json')).toBeInTheDocument();
  });

  it('renders grep tool call with pattern and path fields', () => {
    render(<ActivityRow item={mockGrepToolCall} />);

    expect(screen.getByText('mcp_grep')).toBeInTheDocument();

    const row = screen.getByText('mcp_grep').closest('button');
    fireEvent.click(row!);

    expect(screen.getByText('Pattern')).toBeInTheDocument();
    expect(screen.getByText('export function')).toBeInTheDocument();
    expect(screen.getByText('Path')).toBeInTheDocument();
    expect(screen.getByText('src/')).toBeInTheDocument();
  });

  it('renders bash tool call with command and description fields', () => {
    render(<ActivityRow item={mockBashToolCall} />);

    expect(screen.getByText('mcp_bash')).toBeInTheDocument();

    const row = screen.getByText('mcp_bash').closest('button');
    fireEvent.click(row!);

    expect(screen.getByText('Command')).toBeInTheDocument();
    expect(screen.getByText('npm install')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('Install dependencies')).toBeInTheDocument();
  });

  it('renders webfetch tool call with url field', () => {
    render(<ActivityRow item={mockWebfetchToolCall} />);

    expect(screen.getByText('mcp_webfetch')).toBeInTheDocument();

    const row = screen.getByText('mcp_webfetch').closest('button');
    fireEvent.click(row!);

    expect(screen.getByText('URL')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('shows Advanced section with raw JSON when expanded', () => {
    const { container } = render(<ActivityRow item={mockReadToolCall} />);

    const row = screen.getByText('mcp_read').closest('button');
    fireEvent.click(row!);

    const advancedButton = screen.getByText('Advanced');
    expect(advancedButton).toBeInTheDocument();

    fireEvent.click(advancedButton);

    const preElement = container.querySelector('pre');
    expect(preElement).toBeInTheDocument();
    expect(preElement?.textContent).toContain('filePath');
    expect(preElement?.textContent).toContain('package.json');
  });

  it('hides raw JSON when Advanced section is collapsed', () => {
    const { container } = render(<ActivityRow item={mockReadToolCall} />);

    const row = screen.getByText('mcp_read').closest('button');
    fireEvent.click(row!);

    const advancedButton = screen.getByText('Advanced');
    fireEvent.click(advancedButton);

    let preElement = container.querySelector('pre');
    expect(preElement).toBeInTheDocument();

    fireEvent.click(advancedButton);

    preElement = container.querySelector('pre');
    expect(preElement).not.toBeInTheDocument();
  });

  it('displays error when tool call has error', () => {
    const errorItem: ActivityItem = {
      ...mockReadToolCall,
      state: 'error',
      error: 'File not found',
    };

    render(<ActivityRow item={errorItem} />);

    const row = screen.getByText('mcp_read').closest('button');
    fireEvent.click(row!);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('File not found')).toBeInTheDocument();
  });

  it('renders agent-spawn activity correctly', () => {
    const spawnItem: ActivityItem = {
      id: 'spawn-1',
      type: 'agent-spawn',
      timestamp: new Date('2025-02-02T10:00:00Z'),
      agentName: 'prometheus',
      spawnedAgentName: 'librarian',
    };

    render(<ActivityRow item={spawnItem} />);

    expect(screen.getByText(/Spawned/)).toBeInTheDocument();
    expect(screen.getByText('librarian')).toBeInTheDocument();
  });

  it('renders agent-complete activity correctly', () => {
    const completeItem: ActivityItem = {
      id: 'complete-1',
      type: 'agent-complete',
      timestamp: new Date('2025-02-02T10:00:00Z'),
      agentName: 'librarian',
      status: 'completed',
      durationMs: 5000,
    };

    render(<ActivityRow item={completeItem} />);

    expect(screen.getByText(/Completed task/)).toBeInTheDocument();
    expect(screen.getByText('5s')).toBeInTheDocument();
  });

  it('does not show Advanced button when input is empty', () => {
    const noInputItem: ActivityItem = {
      ...mockReadToolCall,
      input: undefined,
    };

    render(<ActivityRow item={noInputItem} />);

    expect(screen.queryByText('Advanced')).not.toBeInTheDocument();
  });

  it('shows typed fields without raw JSON by default', () => {
    const { container } = render(<ActivityRow item={mockReadToolCall} />);

    const row = screen.getByText('mcp_read').closest('button');
    fireEvent.click(row!);

    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();

    const preElement = container.querySelector('pre');
    expect(preElement).not.toBeInTheDocument();
  });
});
