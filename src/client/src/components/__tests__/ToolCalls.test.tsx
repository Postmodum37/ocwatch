import { render, screen, fireEvent } from '@testing-library/react';
import { ToolCalls } from '../ToolCalls';
import type { ToolCall } from '../../../../shared/types';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Wrench: () => <div data-testid="icon-wrench" />,
  ChevronDown: () => <div data-testid="icon-chevron-down" />,
  ChevronUp: () => <div data-testid="icon-chevron-up" />,
}));

describe('ToolCalls', () => {
  const mockToolCalls: ToolCall[] = [
    {
      id: '1',
      name: 'readFile',
      state: 'complete',
      timestamp: new Date(),
      sessionID: 'session-1',
      messageID: 'msg-1'
    },
    {
      id: '2',
      name: 'writeFile',
      state: 'pending',
      timestamp: new Date(),
      sessionID: 'session-1',
      messageID: 'msg-2'
    },
    {
      id: '3',
      name: 'exec',
      state: 'error',
      timestamp: new Date(),
      sessionID: 'session-1',
      messageID: 'msg-3'
    }
  ];

  it('renders correctly in collapsed state', () => {
    const onToggle = vi.fn();
    render(
      <ToolCalls 
        toolCalls={mockToolCalls} 
        isExpanded={false} 
        onToggle={onToggle} 
      />
    );

    expect(screen.getByTestId('tool-calls-panel')).toBeInTheDocument();
    expect(screen.getByText('Tool Calls')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByTestId('icon-chevron-up')).toBeInTheDocument();
    
    expect(screen.queryByText('readFile')).not.toBeInTheDocument();
  });

  it('renders correctly in expanded state', () => {
    const onToggle = vi.fn();
    render(
      <ToolCalls 
        toolCalls={mockToolCalls} 
        isExpanded={true} 
        onToggle={onToggle} 
      />
    );

    expect(screen.getByTestId('icon-chevron-down')).toBeInTheDocument();
    
    expect(screen.getByText('readFile')).toBeInTheDocument();
    expect(screen.getByText('writeFile')).toBeInTheDocument();
    expect(screen.getByText('exec')).toBeInTheDocument();
    
    expect(screen.getByText('complete')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('calls onToggle when header is clicked', () => {
    const onToggle = vi.fn();
    render(
      <ToolCalls 
        toolCalls={mockToolCalls} 
        isExpanded={false} 
        onToggle={onToggle} 
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('displays empty state message when no calls', () => {
    const onToggle = vi.fn();
    render(
      <ToolCalls 
        toolCalls={[]} 
        isExpanded={true} 
        onToggle={onToggle} 
      />
    );

    expect(screen.getByText('No tool calls recorded yet')).toBeInTheDocument();
  });
});
