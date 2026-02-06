import { render, screen, fireEvent } from '@testing-library/react';
import { SessionList } from '../SessionList';
import type { SessionMetadata, ProjectInfo } from '@shared/types';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../store/AppContext', () => ({
  useAppContext: () => ({
    selectedSessionId: null,
    activeSession: null,
    sessions: [],
    sessionStats: null,
    planProgress: null,
    activitySessions: [],
    lastUpdate: Date.now(),
    isReconnecting: false,
    error: null,
  }),
}));

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
  {
    id: '6',
    projectID: 'p1',
    directory: '/tmp/p1',
    title: 'Waiting User Session',
    status: 'waiting',
    activityType: 'waiting-user',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockProjects: ProjectInfo[] = [
  {
    id: 'p1',
    directory: '/tmp/p1',
    sessionCount: 2,
    lastActivityAt: new Date(),
  },
  {
    id: 'p2',
    directory: '/tmp/p2',
    sessionCount: 1,
    lastActivityAt: new Date(Date.now() - 3600000),
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

  it('shows last activity time in project dropdown', () => {
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
    
    const dropdown = screen.getByTestId('project-dropdown-menu');
    expect(dropdown.textContent).toContain('just now');
    expect(dropdown.textContent).toContain('1h ago');
  });

  it('renders waiting status correctly', () => {
    render(<SessionList sessions={mockSessions} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('session-status-waiting')).toBeDefined();
  });

  it('renders current action text when available', () => {
    render(<SessionList sessions={mockSessions} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('Processing data...')).toBeDefined();
  });

  it('renders waiting-user status with Clock icon', () => {
    render(<SessionList sessions={mockSessions} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId('session-status-waiting-user')).toBeDefined();
  });

  it('differentiates waiting-user from regular waiting status', () => {
    render(<SessionList sessions={mockSessions} selectedId={null} onSelect={() => {}} />);
    const waitingIcon = screen.getByTestId('session-status-waiting');
    const waitingUserIcon = screen.getByTestId('session-status-waiting-user');
    expect(waitingIcon).toBeDefined();
    expect(waitingUserIcon).toBeDefined();
    expect(waitingIcon).not.toBe(waitingUserIcon);
  });

  it('uses stable sort with id as secondary key', () => {
    const sameTimestamp = new Date();
    const sessionsWithSameTime: SessionMetadata[] = [
      { id: 'z', projectID: 'p1', directory: '/tmp', title: 'Z Session', createdAt: sameTimestamp, updatedAt: sameTimestamp },
      { id: 'a', projectID: 'p1', directory: '/tmp', title: 'A Session', createdAt: sameTimestamp, updatedAt: sameTimestamp },
      { id: 'm', projectID: 'p1', directory: '/tmp', title: 'M Session', createdAt: sameTimestamp, updatedAt: sameTimestamp },
    ];
    render(<SessionList sessions={sessionsWithSameTime} selectedId={null} onSelect={() => {}} />);
    const items = screen.getAllByTestId(/session-item-/);
    expect(items[0].getAttribute('data-testid')).toBe('session-item-a');
    expect(items[1].getAttribute('data-testid')).toBe('session-item-m');
    expect(items[2].getAttribute('data-testid')).toBe('session-item-z');
  });

  it('applies attention animation for waiting-user status', () => {
    render(<SessionList sessions={mockSessions} selectedId={null} onSelect={() => {}} />);
    const waitingUserItem = screen.getByTestId('session-item-6');
    expect(waitingUserItem.className).toContain('animate-attention');
  });
});
