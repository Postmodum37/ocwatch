import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { PlanProgress } from '../../../../../shared/types';
import { SidebarPlanProgress } from '../SidebarPlanProgress';
import { usePollData } from '../../../store/PollDataContext';

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

type PollDataMock = {
  sessions: [];
  planProgress: PlanProgress | null;
  planName: string | undefined;
  loading: boolean;
  error: null;
  lastUpdate: number;
  isReconnecting: boolean;
};

const defaultPollData = (): PollDataMock => ({
  sessions: [],
  planProgress: null,
  planName: undefined,
  loading: false,
  error: null,
  lastUpdate: 0,
  isReconnecting: false,
});

const createPollData = (overrides?: Partial<PollDataMock>) => ({
  ...defaultPollData(),
  ...overrides,
});

vi.mock('../../../store/PollDataContext', () => ({
  usePollData: vi.fn(),
}));

const mockUsePollData = vi.mocked(usePollData);

describe('SidebarPlanProgress', () => {
  it('shows no plan when plan is missing', () => {
    mockUsePollData.mockReturnValue(createPollData());
    render(<SidebarPlanProgress />);
    expect(screen.getByText('No plan')).toBeDefined();
  });

  it('shows no plan when project selected but plan missing', () => {
    mockUsePollData.mockReturnValue(createPollData());
    render(<SidebarPlanProgress />);
    expect(screen.getByText('No plan')).toBeDefined();
  });

  it('renders plan progress when plan exists', () => {
    mockUsePollData.mockReturnValue(
      createPollData({ planProgress: mockPlan, planName: 'Plan A' })
    );
    render(<SidebarPlanProgress />);
    expect(screen.getByTestId('sidebar-plan-progress')).toBeDefined();
    expect(screen.getByText('Plan A')).toBeDefined();
  });
});
