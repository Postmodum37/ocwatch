import { render, screen } from '@testing-library/react';
import { LiveActivity } from '../LiveActivity';
import type { ActivitySession } from '../../../../shared/types';
import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

vi.mock('lucide-react', () => ({
  Activity: () => <div data-testid="icon-activity" />,
  Check: () => <div data-testid="icon-check" />,
  Loader2: () => <div data-testid="icon-loader" />,
  Circle: () => <div data-testid="icon-circle" />,
  Clock: () => <div data-testid="icon-clock" />,
  Sparkles: () => <div data-testid="icon-sparkles" />,
  FileEdit: () => <div data-testid="icon-file-edit" />,
  Terminal: () => <div data-testid="icon-terminal" />,
}));

describe('LiveActivity', () => {
  const mockSessions: ActivitySession[] = [
    {
      id: 'session-1',
      title: 'Root session',
      agent: 'prometheus',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      tokens: 1234,
      status: 'working',
      createdAt: new Date('2024-01-15T10:30:00'),
      updatedAt: new Date('2024-01-15T10:35:00'),
    },
    {
      id: 'session-2',
      title: 'Sub session 1',
      agent: 'sisyphus',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      parentID: 'session-1',
      tokens: 567,
      status: 'idle',
      createdAt: new Date('2024-01-15T10:30:05'),
      updatedAt: new Date('2024-01-15T10:32:00'),
    },
    {
      id: 'session-3',
      title: 'Sub session 2',
      agent: 'explore',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      parentID: 'session-2',
      tokens: 89,
      status: 'completed',
      createdAt: new Date('2024-01-15T10:30:10'),
      updatedAt: new Date('2024-01-15T10:31:00'),
    },
  ];

  it('renders empty state when no sessions', () => {
    render(<LiveActivity sessions={[]} loading={false} />);

    expect(screen.getByText('Live Activity')).toBeInTheDocument();
    expect(screen.getByText('No Activity')).toBeInTheDocument();
    expect(screen.getByText('Select a session to view live activity')).toBeInTheDocument();
  });

  it('renders loading skeleton when loading with no sessions', () => {
    render(<LiveActivity sessions={[]} loading={true} />);

    expect(screen.getByText('Live Activity')).toBeInTheDocument();
    expect(screen.queryByText('No Activity')).not.toBeInTheDocument();
  });

  it('renders sessions with agent badges', () => {
    render(<LiveActivity sessions={mockSessions} loading={false} />);

    expect(screen.getByText('prometheus')).toBeInTheDocument();
    expect(screen.getByText('sisyphus')).toBeInTheDocument();
    expect(screen.getByText('explore')).toBeInTheDocument();
  });

  it('displays model information', () => {
    render(<LiveActivity sessions={mockSessions} loading={false} />);

    const modelTexts = screen.getAllByText('anthropic/claude-sonnet-4');
    expect(modelTexts.length).toBeGreaterThan(0);
  });

  it('shows token count when available', () => {
    render(<LiveActivity sessions={mockSessions} loading={false} />);

    expect(screen.getByText('1,234 tokens')).toBeInTheDocument();
    expect(screen.getByText('567 tokens')).toBeInTheDocument();
    expect(screen.getByText('89 tokens')).toBeInTheDocument();
  });

  it('shows connected indicator when sessions exist', () => {
    render(<LiveActivity sessions={mockSessions} loading={false} />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('renders nested sessions with delegation indicator', () => {
    render(<LiveActivity sessions={mockSessions} loading={false} />);

    const delegationIndicators = screen.getAllByText('└');
    expect(delegationIndicators.length).toBe(2);
  });

  it('renders sessions with unknown agent when agent is missing', () => {
    const sessionsWithMissingAgent: ActivitySession[] = [
      {
        id: 'session-1',
        title: 'Test session',
        agent: 'unknown',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    render(<LiveActivity sessions={sessionsWithMissingAgent} loading={false} />);

    expect(screen.getByText('unknown')).toBeInTheDocument();
  });

  it('sorts children by most recent activity (updatedAt descending)', () => {
    const sessionsWithVaryingActivity: ActivitySession[] = [
      {
        id: 'root',
        title: 'Root',
        agent: 'prometheus',
        createdAt: new Date('2024-01-15T10:00:00'),
        updatedAt: new Date('2024-01-15T10:30:00'),
      },
      {
        id: 'child-old',
        title: 'Old child',
        agent: 'explore',
        parentID: 'root',
        createdAt: new Date('2024-01-15T10:05:00'),
        updatedAt: new Date('2024-01-15T10:10:00'),
      },
      {
        id: 'child-recent',
        title: 'Recent child',
        agent: 'sisyphus',
        parentID: 'root',
        createdAt: new Date('2024-01-15T10:03:00'),
        updatedAt: new Date('2024-01-15T10:25:00'),
      },
    ];

    render(<LiveActivity sessions={sessionsWithVaryingActivity} loading={false} />);

    const agentBadges = screen.getAllByText(/sisyphus|explore/);
    expect(agentBadges[0]).toHaveTextContent('sisyphus');
    expect(agentBadges[1]).toHaveTextContent('explore');
  });

  it('displays waiting status with clock icon', () => {
    const waitingSession: ActivitySession[] = [
      {
        id: 'waiting-1',
        title: 'Waiting session',
        agent: 'prometheus',
        status: 'waiting',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    render(<LiveActivity sessions={waitingSession} loading={false} />);
    
    const statusIndicator = screen.getByTestId('status-waiting');
    expect(statusIndicator).toBeInTheDocument();
    expect(screen.getByTestId('icon-clock')).toBeInTheDocument();
  });

   it('displays "waiting on N agents" when workingChildCount > 0', () => {
     const waitingOnChildrenSession: ActivitySession[] = [
       {
         id: 'parent-1',
         title: 'Parent',
         agent: 'prometheus',
         status: 'working',
         workingChildCount: 3,
         createdAt: new Date(),
         updatedAt: new Date(),
       }
     ];

     render(<LiveActivity sessions={waitingOnChildrenSession} loading={false} />);
     
      expect(screen.getByText('Waiting on 3 agents')).toBeInTheDocument();
   });

   it('displays currentAction text instead of "Thinking..."', () => {
     const actionSession: ActivitySession[] = [
       {
         id: 'action-1',
         title: 'Action',
         agent: 'prometheus',
         status: 'working',
         currentAction: 'running tool: ls',
         createdAt: new Date(),
         updatedAt: new Date(),
       }
     ];

     render(<LiveActivity sessions={actionSession} loading={false} />);
     
     expect(screen.getByText('running tool: ls')).toBeInTheDocument();
     expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
   });

    it('shows activity indicator in header when any session is working', () => {
      const workingSession: ActivitySession[] = [
        {
          id: 'working-1',
          title: 'Working',
          agent: 'prometheus',
          status: 'working',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];
      render(<LiveActivity sessions={workingSession} loading={false} />);
      
      const activityIndicator = screen.getByTitle('Activity in progress');
      expect(activityIndicator).toBeInTheDocument();
    });

    it('does not show activity indicator when no session is working', () => {
      const idleSession: ActivitySession[] = [
        {
          id: 'idle-1',
          title: 'Idle',
          agent: 'prometheus',
          status: 'idle',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];
      render(<LiveActivity sessions={idleSession} loading={false} />);
      
      const activityIndicator = screen.queryByTitle('Activity in progress');
      expect(activityIndicator).not.toBeInTheDocument();
    });

    it('applies glow animation to working status indicator', () => {
      const workingSession: ActivitySession[] = [
        {
          id: 'working-glow',
          title: 'Working',
          agent: 'prometheus',
          status: 'working',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];
      render(<LiveActivity sessions={workingSession} loading={false} />);
      
      const statusIndicator = screen.getByTestId('status-working');
      expect(statusIndicator.className).toContain('animate-badge-glow');
    });

    describe('SessionRow compact layout', () => {
      it('displays full action text without truncation', () => {
        const longActionSession: ActivitySession[] = [{
          id: 'long-action',
          title: 'Test',
          agent: 'sisyphus',
          status: 'working',
          currentAction: 'This is a very long action text that should be truncated at approximately eighty characters total',
          createdAt: new Date(),
          updatedAt: new Date(),
        }];
        render(<LiveActivity sessions={longActionSession} loading={false} />);
        
        const actionText = screen.getByTestId('current-action');
        expect(actionText.textContent).toBe('This is a very long action text that should be truncated at approximately eighty characters total');
      });

      it('shows tool name with primary argument on separate line when toolCalls exist', () => {
        const sessionWithTool: ActivitySession[] = [{
          id: 'with-tool',
          title: 'Test',
          agent: 'sisyphus',
          status: 'working',
          currentAction: 'Working on files',
          createdAt: new Date(),
          updatedAt: new Date(),
          toolCalls: [{
            id: 't1',
            name: 'mcp_read',
            state: 'pending',
            summary: 'Reading file',
            input: { filePath: 'src/auth.ts' },
            timestamp: new Date().toISOString(),
            agentName: 'sisyphus'
          }]
        }];
        render(<LiveActivity sessions={sessionWithTool} loading={false} />);
        
        const toolInfo = screen.getByTestId('tool-info');
        expect(toolInfo.textContent).toContain('read');
        expect(toolInfo.textContent).toContain('src/auth.ts');
      });

      it('applies opacity-60 class to completed agents', () => {
        const completedSession: ActivitySession[] = [{
          id: 'completed-1',
          title: 'Done',
          agent: 'explore',
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
        }];
        render(<LiveActivity sessions={completedSession} loading={false} />);
        
        const row = screen.getByTestId('session-row-completed-1');
        expect(row.className).toContain('opacity-60');
      });

      it('formats time without "ago" suffix', () => {
        const session: ActivitySession[] = [{
          id: 'time-test',
          title: 'Test',
          agent: 'sisyphus',
          status: 'working',
          createdAt: new Date(),
          updatedAt: new Date(Date.now() - 5 * 60 * 1000),
        }];
        render(<LiveActivity sessions={session} loading={false} />);
        
        expect(screen.getByText('5m')).toBeInTheDocument();
        expect(screen.queryByText('5m ago')).not.toBeInTheDocument();
      });
    });
});
