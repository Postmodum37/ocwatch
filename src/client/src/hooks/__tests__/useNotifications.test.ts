import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNotifications } from '../useNotifications';
import type { SessionMetadata } from '@shared/types';

describe('useNotifications', () => {
  let notificationConstructor: ReturnType<typeof vi.fn>;
  let originalNotification: typeof Notification;

  beforeEach(() => {
    notificationConstructor = vi.fn();
    
    originalNotification = globalThis.Notification;
    
    Object.defineProperty(globalThis, 'Notification', {
      writable: true,
      configurable: true,
      value: class MockNotification {
        static permission: NotificationPermission = 'granted';
        static requestPermission = vi.fn().mockResolvedValue('granted');
        
        constructor(title: string, options?: NotificationOptions) {
          notificationConstructor(title, options);
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

    expect(notificationConstructor).not.toHaveBeenCalled();
  });

  it('transition from working → waiting-user fires notification', () => {
    const initialSessions = [createSession('s1', { activityType: 'tool' })];

    const { rerender } = renderHook(
      ({ sessions, isReconnecting }) => useNotifications(sessions, isReconnecting),
      {
        initialProps: { sessions: initialSessions, isReconnecting: false },
      }
    );

    expect(notificationConstructor).not.toHaveBeenCalled();

    act(() => {
      rerender({
        sessions: [createSession('s1', { activityType: 'waiting-user' })],
        isReconnecting: false,
      });
    });

    expect(notificationConstructor).toHaveBeenCalledWith('🔔 Input needed', {
      body: 'TestAgent is waiting for your response',
      tag: 'ocwatch-waiting-s1',
      requireInteraction: false,
    });
  });

  it('transition from working → completed fires notification', () => {
    const initialSessions = [createSession('s1', { status: 'working' })];

    const { rerender } = renderHook(
      ({ sessions, isReconnecting }) => useNotifications(sessions, isReconnecting),
      {
        initialProps: { sessions: initialSessions, isReconnecting: false },
      }
    );

    expect(notificationConstructor).not.toHaveBeenCalled();

    act(() => {
      rerender({
        sessions: [createSession('s1', { status: 'completed' })],
        isReconnecting: false,
      });
    });

    expect(notificationConstructor).toHaveBeenCalledWith('✅ Agent completed', {
      body: 'TestAgent finished work',
      tag: 'ocwatch-completed-s1',
      requireInteraction: false,
    });
  });

  it('no notification when tab is visible', () => {
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

    expect(notificationConstructor).not.toHaveBeenCalled();
  });

  it('no notification for subagent transitions', () => {
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

    expect(notificationConstructor).not.toHaveBeenCalled();
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

    expect(notificationConstructor).toHaveBeenCalledTimes(1);

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

    expect(notificationConstructor).toHaveBeenCalledTimes(1);
  });

  it('SSE reconnection resets baseline', () => {
    const initialSessions = [createSession('s1', { activityType: 'waiting-user' })];

    const { rerender } = renderHook(
      ({ sessions, isReconnecting }) => useNotifications(sessions, isReconnecting),
      {
        initialProps: { sessions: initialSessions, isReconnecting: false },
      }
    );

    expect(notificationConstructor).not.toHaveBeenCalled();

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

    expect(notificationConstructor).toHaveBeenCalledTimes(1);
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
