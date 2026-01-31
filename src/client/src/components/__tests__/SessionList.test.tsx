import { render, screen, fireEvent } from '@testing-library/react';
import { SessionList } from '../SessionList';
import type { SessionMetadata } from '@shared/types';
import { describe, it, expect, vi } from 'vitest';

const mockSessions: SessionMetadata[] = [
  {
    id: '1',
    projectID: 'p1',
    directory: '/tmp/p1',
    title: 'Active Session',
    createdAt: new Date(),
    updatedAt: new Date(), // Just now
  },
  {
    id: '2',
    projectID: 'p1',
    directory: '/tmp/p1',
    title: 'Idle Session',
    createdAt: new Date(Date.now() - 1000000),
    updatedAt: new Date(Date.now() - 3600000), // 1 hour ago
  },
];

describe('SessionList', () => {
  it('renders the session list header', () => {
    render(<SessionList sessions={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('Sessions')).toBeDefined();
  });

  it('renders session items', () => {
    render(<SessionList sessions={mockSessions} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('Active Session')).toBeDefined();
    expect(screen.getByText('Idle Session')).toBeDefined();
  });

  it('shows relative time', () => {
    render(<SessionList sessions={mockSessions} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('just now')).toBeDefined();
    expect(screen.getByText('1h ago')).toBeDefined();
  });

  it('calls onSelect when a session is clicked', () => {
    const onSelect = vi.fn();
    render(<SessionList sessions={mockSessions} selectedId={null} onSelect={onSelect} />);
    
    fireEvent.click(screen.getByText('Active Session'));
    expect(onSelect).toHaveBeenCalledWith('1');
  });

  it('highlights selected session', () => {
    render(<SessionList sessions={mockSessions} selectedId="1" onSelect={() => {}} />);
    const activeItem = screen.getByTestId('session-item-1');
    expect(activeItem.className).toContain('bg-background');
    expect(activeItem.className).toContain('border-l-accent');
  });
});
