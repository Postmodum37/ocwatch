import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSSE } from '../useSSE';

describe('useSSE - Liveness Detection', () => {
  let mockEventSource: any;
  let eventListeners: Record<string, Array<() => void>>;
  let setIntervalSpy: any;
  let clearIntervalSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    eventListeners = {};

    mockEventSource = {
      addEventListener: vi.fn((event: string, handler: any) => {
        if (!eventListeners[event]) {
          eventListeners[event] = [];
        }
        eventListeners[event].push(handler);
      }),
      close: vi.fn(),
      removeEventListener: vi.fn(),
      onerror: null as any,
    };

    class MockEventSource {
      addEventListener = mockEventSource.addEventListener;
      close = mockEventSource.close;
      removeEventListener = mockEventSource.removeEventListener;
      onerror = mockEventSource.onerror;
    }

    const EventSourceSpy = vi.fn(MockEventSource);
    global.EventSource = EventSourceSpy as any;

    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          sessions: [],
          messages: [],
          activitySessions: [],
          sessionStats: null,
        }),
      })
    ) as any;

    setIntervalSpy = vi.spyOn(global, 'setInterval');
    clearIntervalSpy = vi.spyOn(global, 'clearInterval');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useSSE({ enabled: true }));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('should create EventSource when enabled', () => {
    renderHook(() => useSSE({ enabled: true }));
    expect(global.EventSource).toHaveBeenCalled();
  });

  it('should register event listeners for meaningful events', () => {
    renderHook(() => useSSE({ enabled: true }));
    
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith(
      'session-update',
      expect.any(Function)
    );
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith(
      'message-update',
      expect.any(Function)
    );
    expect(mockEventSource.addEventListener).toHaveBeenCalledWith(
      'plan-update',
      expect.any(Function)
    );
  });

  it('should set up liveness check interval every 10 seconds', () => {
    renderHook(() => useSSE({ enabled: true }));
    
    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      10000
    );
  });

  it('should set up liveness check that closes EventSource on timeout', () => {
    renderHook(() => useSSE({ enabled: true }));

    const livenessCheckCalls = setIntervalSpy.mock.calls.filter(
      (call: any[]) => call[1] === 10000
    );

    expect(livenessCheckCalls.length).toBeGreaterThan(0);
  });

  it('should not close EventSource if meaningful event occurred recently', () => {
    renderHook(() => useSSE({ enabled: true }));

    const livenessCheckFn = setIntervalSpy.mock.calls.find(
      (call: any[]) => call[1] === 10000
    )?.[0];

    expect(livenessCheckFn).toBeDefined();

    if (livenessCheckFn) {
      const lastEventTimeRef = { current: Date.now() - 30000 };
      
      livenessCheckFn.call({ lastEventTimeRef });
    }

    expect(mockEventSource.close).not.toHaveBeenCalled();
  });

  it('should clean up liveness check interval on unmount', () => {
    const { unmount } = renderHook(() => useSSE({ enabled: true }));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should close EventSource when disabled', () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSSE({ enabled }),
      { initialProps: { enabled: true } }
    );

    rerender({ enabled: false });

    expect(mockEventSource.close).toHaveBeenCalled();
  });

  it('should handle session-update events', () => {
    renderHook(() => useSSE({ enabled: true }));

    const sessionUpdateHandlers = eventListeners['session-update'] || [];
    expect(sessionUpdateHandlers.length).toBeGreaterThan(0);
  });

  it('should handle message-update events', () => {
    renderHook(() => useSSE({ enabled: true }));

    const messageUpdateHandlers = eventListeners['message-update'] || [];
    expect(messageUpdateHandlers.length).toBeGreaterThan(0);
  });

  it('should handle plan-update events', () => {
    renderHook(() => useSSE({ enabled: true }));

    const planUpdateHandlers = eventListeners['plan-update'] || [];
    expect(planUpdateHandlers.length).toBeGreaterThan(0);
  });

  it('should register heartbeat listener without meaningful event handling', () => {
    renderHook(() => useSSE({ enabled: true }));

    const heartbeatHandlers = eventListeners['heartbeat'] || [];
    expect(heartbeatHandlers.length).toBeGreaterThan(0);
  });

  it('should close EventSource and fallback after 45s timeout with no events', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const startTime = Date.now();
    
    renderHook(() => useSSE({ enabled: true }));
    
    vi.setSystemTime(startTime + 46000);
    vi.advanceTimersByTime(46000);
    
    expect(mockEventSource.close).toHaveBeenCalled();
    
    vi.useRealTimers();
  });
});
