import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { PlanProgress, SessionDetail } from '../../../../../shared/types';
import { SidebarPlanProgress } from '../SidebarPlanProgress';
import { useAppContext } from '../../../store/AppContext';

const mockPlan: PlanProgress = {
  completed: 1,
  total: 3,
  progress: 33,
  tasks: [
    { description: 'First task', completed: true },
    { description: 'Second task', completed: false },
    { description: 'Third task', completed: false },
  ],
};

type AppContextMock = {
  sessions: [];
  sessionDetail: SessionDetail | null;
  sessionDetailLoading: boolean;
  planProgress: PlanProgress | null;
  planName: string | undefined;
  sessionStats: null;
  messages: [];
  activitySessions: [];
  selectedSessionId: string | null;
  projects: [];
  selectedProjectId: string | null;
  loading: boolean;
  error: null;
  lastUpdate: number;
  isReconnecting: boolean;
  agentFilter: string[];
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<NotificationPermission>;
  setSelectedSessionId: (id: string | null) => void;
  setSelectedProjectId: (id: string) => void;
  setAgentFilter: (agents: string[]) => void;
};

const defaultContext = (): AppContextMock => ({
  sessions: [],
  sessionDetail: null,
  sessionDetailLoading: false,
  planProgress: null,
  planName: undefined,
  sessionStats: null,
  messages: [],
  activitySessions: [],
  selectedSessionId: null,
  projects: [],
  selectedProjectId: null,
  loading: false,
  error: null,
  lastUpdate: 0,
  isReconnecting: false,
  agentFilter: [],
  notificationPermission: 'default' as NotificationPermission,
  requestNotificationPermission: async () => 'default' as NotificationPermission,
  setSelectedSessionId: () => {},
  setSelectedProjectId: () => {},
  setAgentFilter: () => {},
});

const createAppContext = (overrides?: Partial<ReturnType<typeof defaultContext>>) => ({
  ...defaultContext(),
  ...overrides,
});

vi.mock('../../../store/AppContext', () => ({
  useAppContext: vi.fn(),
}));

const mockUseAppContext = vi.mocked(useAppContext);

describe('SidebarPlanProgress', () => {
  it('shows no plan when plan is missing', () => {
    mockUseAppContext.mockReturnValue(createAppContext());
    render(<SidebarPlanProgress />);
    expect(screen.getByText('No plan')).toBeDefined();
  });

  it('shows no plan when project selected but plan missing', () => {
    mockUseAppContext.mockReturnValue(createAppContext({ selectedProjectId: 'p1' }));
    render(<SidebarPlanProgress />);
    expect(screen.getByText('No plan')).toBeDefined();
  });

  it('renders plan progress when plan exists', () => {
    mockUseAppContext.mockReturnValue(
      createAppContext({ selectedProjectId: 'p1', planProgress: mockPlan, planName: 'Plan A' })
    );
    render(<SidebarPlanProgress />);
    expect(screen.getByTestId('sidebar-plan-progress')).toBeDefined();
    expect(screen.getByText('Plan A')).toBeDefined();
  });
});
