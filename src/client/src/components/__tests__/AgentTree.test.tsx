import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AgentTree from '../AgentTree';
import type { SessionMetadata } from '../../../../shared/types';

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserver);

describe('AgentTree', () => {
  const mockSessions: SessionMetadata[] = [
    {
      id: 'session-1',
      projectID: 'proj-1',
      directory: '/tmp',
      title: 'Root Session',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'session-2',
      projectID: 'proj-1',
      directory: '/tmp',
      title: 'Child Session',
      parentID: 'session-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it('renders without crashing', () => {
    render(
      <AgentTree 
        sessions={mockSessions} 
        selectedId={null} 
        onSelect={() => {}} 
      />
    );
    expect(screen.getByTestId('agent-tree')).toBeTruthy();
  });

  it('renders empty state when no sessions provided', () => {
    render(
      <AgentTree 
        sessions={[]} 
        selectedId={null} 
        onSelect={() => {}} 
      />
    );
    expect(screen.getByTestId('agent-tree-empty')).toBeTruthy();
    expect(screen.getByText('No Active Sessions')).toBeTruthy();
  });
});
