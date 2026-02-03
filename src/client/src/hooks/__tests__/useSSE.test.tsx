import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSSE } from '../useSSE';
import type { PollResponse } from '../usePolling';

const mockUsePolling = vi.fn();
const mockPollingState = {
  data: {
    sessions: [],
    activeSession: null,
    planProgress: null,
    messages: [],
    activitySessions: [],
    lastUpdate: 12345,
  } as PollResponse,
  loading: false,
  error: null,
  lastUpdate: 12345,
  isReconnecting: false,
  failedAttempts: 0
};

vi.mock('../usePolling', () => ({
  usePolling: (options: unknown) => {
    mockUsePolling(options);
    return mockPollingState;
  }
}));

const mockPollResponse: PollResponse = {
  sessions: [],
  activeSession: null,
  planProgress: null,
  messages: [],
  activitySessions: [],
  lastUpdate: Date.now(),
};

describe('useSSE', () => {
  let MockEventSource: ReturnType<typeof vi.fn>;
  let eventSourceInstance: {
    listeners: Map<string, Array<(event?: unknown) => void>>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onerror: ((event: unknown) => void) | null;
  };

  beforeEach(() => {
    mockUsePolling.mockClear();
    vi.clearAllTimers();

    const listeners = new Map<string, Array<(event?: unknown) => void>>();
    
    eventSourceInstance = {
      listeners,
      addEventListener: vi.fn((event: string, handler: (event?: unknown) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event)!.push(handler);
      }),
      removeEventListener: vi.fn(),
      close: vi.fn(),
      onerror: null,
    };

    MockEventSource = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).EventSource = function(_url: string) {
      MockEventSource(_url);
      return eventSourceInstance;
    };
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPollResponse),
    }) as unknown as typeof fetch;

    Object.defineProperty(document, 'visibilityState', { 
      value: 'visible', 
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const triggerEvent = (eventName: string, data?: unknown) => {
    const handlers = eventSourceInstance.listeners.get(eventName);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  };

  it('connects to SSE on mount', async () => {
    renderHook(() => useSSE());
    await waitFor(() => {
      expect(MockEventSource).toHaveBeenCalledWith('/api/sse');
    });
    expect(mockUsePolling).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('connects with session ID', async () => {
    renderHook(() => useSSE({ sessionId: '123' }));
    await waitFor(() => {
      expect(MockEventSource).toHaveBeenCalledWith('/api/sse?sessionId=123');
    });
  });

  it('handles incoming messages with debounce', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSSE());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => {
      triggerEvent('connected');
    });

    act(() => {
      triggerEvent('session-update', { data: '{}' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(global.fetch).toHaveBeenCalled();
    expect(result.current.data).toEqual(mockPollResponse);
    vi.useRealTimers();
  });

  it('falls back to polling on error', async () => {
    const { result } = renderHook(() => useSSE());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      if (eventSourceInstance.onerror) {
        eventSourceInstance.onerror(new Error('Connection lost'));
      }
    });

    await waitFor(() => {
      expect(mockUsePolling).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
    });

    expect(result.current).toBe(mockPollingState);
  });

  it('reconnects SSE on visibility change', async () => {
    renderHook(() => useSSE());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      if (eventSourceInstance.onerror) {
        eventSourceInstance.onerror(new Error('Connection lost'));
      }
    });

    await waitFor(() => {
      expect(mockUsePolling).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }));
    });

    MockEventSource.mockClear();

    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(MockEventSource).toHaveBeenCalledTimes(1);
    });
    
    expect(mockUsePolling).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('cleans up EventSource on unmount', async () => {
    const { unmount } = renderHook(() => useSSE());
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    
    unmount();
    expect(eventSourceInstance.close).toHaveBeenCalled();
  });
});
