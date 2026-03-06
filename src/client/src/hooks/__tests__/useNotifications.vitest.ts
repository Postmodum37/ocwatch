import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '../useNotifications';

interface SessionMetadata {
  id: string;
  projectID: string;
  directory: string;
  title: string;
  agent?: string | null;
  status?: 'working' | 'idle' | 'completed' | 'waiting';
  activityType?: 'tool' | 'reasoning' | 'patch' | 'waiting-tools' | 'waiting-user' | 'idle';
  parentID?: string;
  createdAt: Date;
  updatedAt: Date;
}

describe('useNotifications', () => {
  let notificationCalls: Array<{ title: string; options?: NotificationOptions }>;
  let originalNotification: typeof Notification;

  beforeEach(() => {
    notificationCalls = [];
    
    originalNotification = globalThis.Notification;
    
    Object.defineProperty(globalThis, 'Notification', {
      writable: true,
      configurable: true,
      value: class MockNotification {
        static permission: NotificationPermission = 'granted';
        static requestPermission = vi.fn().mockResolvedValue('granted');
        
        constructor(title: string, options?: NotificationOptions) {
          notificationCalls.push({ title, options });
        }
      },
    });

    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'hidden',
    });
  });

  afterEach(() => {
    globalThis.Notification = originalNotification;
    vi.clearAllMocks();
  });

  const createSession = (
    id: string,
    overrides?: Partial<SessionMetadata>
  ): SessionMetadata => ({
    id,
    projectID: 'test-project',
    directory: '/test',
    title: `Session ${id}`,
    agent: 'TestAgent',
    status: 'working',
    activityType: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  it('first render with existing waiting-user sessions does NOT fire notifications', () => {
    const sessions = [
      createSession('s1', { activityType: 'waiting-user' }),
      createSession('s2', { activityType: 'waiting-user' }),
    ];

    renderHook(() => useNotifications(sessions, false));

    expect(notificationCalls).toHaveLength(0);
  });

  it('transition from working → waiting-user fires notification', () => {
    const initialSessions = [createSession('s1', { activityType: 'tool' })];

    const { rerender } = renderHook(
      ({ sessions, isReconnecting }) => useNotifications(sessions, isReconnecting),
      {
        initialProps: { sessions: initialSessions, isReconnecting: false },
      }
    );

    expect(notificationCalls).toHaveLength(0);

    act(() => {
      rerender({
        sessions: [createSession('s1', { activityType: 'waiting-user' })],
        isReconnecting: false,
      });
    });

    expect(notificationCalls).toHaveLength(1);
    expect(notificationCalls[0]).toEqual({
      title: '🔔 Input needed',
      options: {
        body: 'TestAgent is waiting for your response',
        tag: 'ocwatch-waiting-s1',
        requireInteraction: false,
      },
    });
  });

  it('transition from working → completed does not fire notification', () => {
    const initialSessions = [createSession('s1', { status: 'working' })];

    const { rerender } = renderHook(
      ({ sessions, isReconnecting }) => useNotifications(sessions, isReconnecting),
      {
        initialProps: { sessions: initialSessions, isReconnecting: false },
      }
    );

    expect(notificationCalls).toHaveLength(0);

    act(() => {
      rerender({
        sessions: [createSession('s1', { status: 'completed' })],
        isReconnecting: false,
      });
    });

    expect(notificationCalls).toHaveLength(0);
  });

  it('fires notification even when tab is visible', () => {
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'visible',
    });

    const initialSessions = [createSession('s1', { activityType: 'tool' })];

    const { rerender } = renderHook(
      ({ sessions, isReconnecting }) => useNotifications(sessions, isReconnecting),
      {
        initialProps: { sessions: initialSessions, isReconnecting: false },
      }
    );

    act(() => {
      rerender({
        sessions: [createSession('s1', { activityType: 'waiting-user' })],
        isReconnecting: false,
      });
    });

    expect(notificationCalls).toHaveLength(1);
  });

  it('fires notification for subagent transitions when included in activity sessions', () => {
    const initialSessions = [
      createSession('s1', { activityType: 'tool', parentID: 'parent-session' }),
    ];

    const { rerender } = renderHook(
      ({ sessions, isReconnecting }) => useNotifications(sessions, isReconnecting),
      {
        initialProps: { sessions: initialSessions, isReconnecting: false },
      }
    );

    act(() => {
      rerender({
        sessions: [
          createSession('s1', {
            activityType: 'waiting-user',
            parentID: 'parent-session',
          }),
        ],
        isReconnecting: false,
      });
    });

    expect(notificationCalls).toHaveLength(1);
    expect(notificationCalls[0]).toEqual({
      title: '🔔 Input needed',
      options: {
        body: 'TestAgent is waiting for your response',
        tag: 'ocwatch-waiting-s1',
        requireInteraction: false,
      },
    });
  });

  it('cooldown prevents rapid-fire', () => {
    const initialSessions = [createSession('s1', { activityType: 'tool' })];

    const { rerender } = renderHook(
      ({ sessions, isReconnecting }) => useNotifications(sessions, isReconnecting),
      {
        initialProps: { sessions: initialSessions, isReconnecting: false },
      }
    );

    act(() => {
      rerender({
        sessions: [createSession('s1', { activityType: 'waiting-user' })],
        isReconnecting: false,
      });
    });

    expect(notificationCalls).toHaveLength(1);

    act(() => {
      rerender({
        sessions: [createSession('s1', { activityType: 'tool' })],
        isReconnecting: false,
      });
    });

    act(() => {
      rerender({
        sessions: [createSession('s1', { activityType: 'waiting-user' })],
        isReconnecting: false,
      });
    });

    expect(notificationCalls).toHaveLength(1);
  });

  it('SSE reconnection resets baseline', () => {
    const initialSessions = [createSession('s1', { activityType: 'waiting-user' })];

    const { rerender } = renderHook(
      ({ sessions, isReconnecting }) => useNotifications(sessions, isReconnecting),
      {
        initialProps: { sessions: initialSessions, isReconnecting: false },
      }
    );

    expect(notificationCalls).toHaveLength(0);

    act(() => {
      rerender({ sessions: initialSessions, isReconnecting: true });
    });

    act(() => {
      rerender({ sessions: initialSessions, isReconnecting: false });
    });

    act(() => {
      rerender({
        sessions: [createSession('s1', { activityType: 'tool' })],
        isReconnecting: false,
      });
    });

    act(() => {
      rerender({
        sessions: [createSession('s1', { activityType: 'waiting-user' })],
        isReconnecting: false,
      });
    });

    expect(notificationCalls).toHaveLength(1);
  });

  it('requestPermission updates state and calls API', async () => {
    const MockNotification = globalThis.Notification as unknown as {
      permission: NotificationPermission;
      requestPermission: ReturnType<typeof vi.fn>;
    };
    MockNotification.permission = 'default';

    const { result } = renderHook(() => useNotifications([], false));

    expect(result.current.permission).toBe('default');

    await act(async () => {
      const perm = await result.current.requestPermission();
      expect(perm).toBe('granted');
    });

    expect(MockNotification.requestPermission).toHaveBeenCalled();
  });

  it('enabled returns true when permission is granted', () => {
    const { result } = renderHook(() => useNotifications([], false));

    expect(result.current.enabled).toBe(true);
  });

  it('enabled returns false when permission is denied', () => {
    const MockNotification = globalThis.Notification as unknown as {
      permission: NotificationPermission;
    };
    MockNotification.permission = 'denied';

    const { result } = renderHook(() => useNotifications([], false));

    expect(result.current.enabled).toBe(false);
  });

});
