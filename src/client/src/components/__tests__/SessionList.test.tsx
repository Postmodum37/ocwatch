import { render, screen, fireEvent } from '@testing-library/react';
import { SessionList } from '../SessionList';
import type { SessionMetadata, ProjectInfo } from '@shared/types';
import { describe, it, expect, vi } from 'vitest';

const mockSessions: SessionMetadata[] = [
  {
    id: '1',
    projectID: 'p1',
    directory: '/tmp/p1',
    title: 'Active Session',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    projectID: 'p1',
    directory: '/tmp/p1',
    title: 'Idle Session',
    createdAt: new Date(Date.now() - 1000000),
    updatedAt: new Date(Date.now() - 3600000),
  },
  {
    id: '3',
    projectID: 'p2',
    directory: '/tmp/p2',
    title: 'Project 2 Session',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '4',
    projectID: 'p1',
    directory: '/tmp/p1',
    title: 'Waiting Session',
    status: 'waiting',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '5',
    projectID: 'p1',
    directory: '/tmp/p1',
    title: 'Action Session',
    status: 'working',
    currentAction: 'Processing data...',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockProjects: ProjectInfo[] = [
  {
    id: 'p1',
    directory: '/tmp/p1',
    sessionCount: 2,
  },
  {
    id: 'p2',
    directory: '/tmp/p2',
    sessionCount: 1,
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
    // First session is recent (updatedAt: new Date())
    expect(screen.getAllByText('just now').length).toBeGreaterThan(0);
    // Second session is 3600000ms ago (exactly 1 hour)
    // formatRelativeTime: if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    // 3600000ms = 3600s, Math.floor(3600 / 3600) = 1
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

  it('renders project dropdown button', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        selectedId={null} 
        onSelect={() => {}}
        projects={mockProjects}
        selectedProjectId={null}
        onProjectSelect={() => {}}
      />
    );
    expect(screen.getByTestId('project-dropdown-button')).toBeDefined();
  });

  it('opens dropdown when button is clicked', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        selectedId={null} 
        onSelect={() => {}}
        projects={mockProjects}
        selectedProjectId={null}
        onProjectSelect={() => {}}
      />
    );
    
    const button = screen.getByTestId('project-dropdown-button');
    fireEvent.click(button);
    expect(screen.getByTestId('project-dropdown-menu')).toBeDefined();
  });

  it('filters sessions by selected project', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        selectedId={null} 
        onSelect={() => {}}
        projects={mockProjects}
        selectedProjectId="p1"
        onProjectSelect={() => {}}
      />
    );
    
    expect(screen.getByText('Active Session')).toBeDefined();
    expect(screen.getByText('Idle Session')).toBeDefined();
    expect(screen.queryByText('Project 2 Session')).toBeNull();
  });

  it('shows all sessions when no project is selected', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        selectedId={null} 
        onSelect={() => {}}
        projects={mockProjects}
        selectedProjectId={null}
        onProjectSelect={() => {}}
      />
    );
    
    expect(screen.getByText('Active Session')).toBeDefined();
    expect(screen.getByText('Idle Session')).toBeDefined();
    expect(screen.getByText('Project 2 Session')).toBeDefined();
  });

  it('calls onProjectSelect when project option is clicked', () => {
    const onProjectSelect = vi.fn();
    render(
      <SessionList 
        sessions={mockSessions} 
        selectedId={null} 
        onSelect={() => {}}
        projects={mockProjects}
        selectedProjectId={null}
        onProjectSelect={onProjectSelect}
      />
    );
    
    const button = screen.getByTestId('project-dropdown-button');
    fireEvent.click(button);
    
    const projectOption = screen.getByTestId('project-option-p1');
    fireEvent.click(projectOption);
    
    expect(onProjectSelect).toHaveBeenCalledWith('p1');
  });

  it('shows session count in project dropdown', () => {
    render(
      <SessionList 
        sessions={mockSessions} 
        selectedId={null} 
        onSelect={() => {}}
        projects={mockProjects}
        selectedProjectId={null}
        onProjectSelect={() => {}}
      />
    );
    
    const button = screen.getByTestId('project-dropdown-button');
    fireEvent.click(button);
    
    expect(screen.getByText('(2)')).toBeDefined();
    expect(screen.getByText('(1)')).toBeDefined();
  });

  it('renders waiting status correctly', () => {
    render(<SessionList sessions={mockSessions} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('session-status-waiting')).toBeDefined();
  });

  it('renders current action text when available', () => {
    render(<SessionList sessions={mockSessions} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('Processing data...')).toBeDefined();
  });
});
