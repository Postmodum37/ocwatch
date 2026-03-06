import { useState, useEffect, useRef, useCallback } from 'react';
import { usePolling } from './usePolling';
import { useScopedFetch } from './useScopedFetch';
import type { PollResponse } from '@shared/types';
import { appendProjectId, resolveApiEndpoint } from './resolveApiEndpoint';

export interface UseSSEState {
  data: PollResponse | null;
  loading: boolean;
  error: Error | null;
  lastUpdate: number;
  isReconnecting: boolean;
  failedAttempts: number;
}

export interface UseSSEOptions {
  enabled?: boolean;
  apiUrl?: string;
  pollingInterval?: number;
  projectId?: string | null;
}

export function useSSE(options: UseSSEOptions = {}): UseSSEState {
  const {
    enabled = true,
    apiUrl,
    pollingInterval = 2000,
    projectId,
  } = options;

  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const [sseState, setSseState] = useState<UseSSEState>({
    data: null,
    loading: true,
    error: null,
    lastUpdate: 0,
    isReconnecting: false,
    failedAttempts: 0,
  });

  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());
  const previousScopeKeyRef = useRef(projectId ?? '');
  const sseEndpoint = resolveApiEndpoint(apiUrl, 'sse');
  const pollEndpoint = appendProjectId(resolveApiEndpoint(apiUrl, 'poll'), projectId);

  const scopeKey = projectId ?? '';
  const { createAbortController, isStale, getCurrentScopeKey } = useScopedFetch(scopeKey);

  const pollingState = usePolling({
    enabled: enabled && isUsingFallback,
    interval: pollingInterval,
    apiUrl,
    projectId,
  });

  const fetchData = useCallback(async () => {
    const fetchScopeKey = getCurrentScopeKey();
    const abortController = createAbortController();

    try {
      const response = await fetch(pollEndpoint, { signal: abortController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: PollResponse = await response.json();

      if (!isStale(fetchScopeKey)) {
        setSseState(prev => ({
          ...prev,
          data,
          loading: false,
          lastUpdate: Date.now(),
          error: null,
          isReconnecting: false,
        }));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch data:', err);
    }
  }, [createAbortController, getCurrentScopeKey, isStale, pollEndpoint]);

  useEffect(() => {
    if (previousScopeKeyRef.current === scopeKey) {
      return;
    }

    previousScopeKeyRef.current = scopeKey;
    lastEventTimeRef.current = Date.now();
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsUsingFallback(false);
    setSseState({
      data: null,
      loading: true,
      error: null,
      lastUpdate: 0,
      isReconnecting: false,
      failedAttempts: 0,
    });
  }, [scopeKey]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        lastEventTimeRef.current = Date.now();
        setSseState(prev => ({ ...prev, isReconnecting: true }));
        setIsUsingFallback(false);
      }
    };

    const handleOnline = () => {
      if (!enabled) {
        return;
      }
      lastEventTimeRef.current = Date.now();
      setSseState(prev => ({ ...prev, isReconnecting: true }));
      setIsUsingFallback(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isUsingFallback) {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    const retryDelayMs = Math.min(30000, 2000 * Math.max(1, sseState.failedAttempts));
    reconnectTimeoutRef.current = setTimeout(() => {
      setSseState(prev => ({ ...prev, isReconnecting: true }));
      setIsUsingFallback(false);
    }, retryDelayMs);

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [enabled, isUsingFallback, sseState.failedAttempts]);

  useEffect(() => {
    if (!enabled || isUsingFallback) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    lastEventTimeRef.current = Date.now();
    fetchData();
    const sseUrl = appendProjectId(sseEndpoint, projectId);
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    const handleSSEEvent = () => {
      lastEventTimeRef.current = Date.now();

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        fetchData();
      }, 100);
    };

    es.addEventListener('connected', () => {
      lastEventTimeRef.current = Date.now();
      setSseState(prev => ({
        ...prev,
        error: null,
        isReconnecting: false,
        failedAttempts: 0
      }));
    });

    es.addEventListener('session-update', handleSSEEvent);
    es.addEventListener('message-update', handleSSEEvent);
    es.addEventListener('part-update', handleSSEEvent);
    es.addEventListener('plan-update', handleSSEEvent);
    es.addEventListener('heartbeat', () => {
      lastEventTimeRef.current = Date.now();
    });

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setSseState(prev => ({
        ...prev,
        error: new Error('SSE Connection Failed'),
        isReconnecting: true,
        failedAttempts: prev.failedAttempts + 1,
      }));
      setIsUsingFallback(true);
    };

    const livenessCheckInterval = setInterval(() => {
      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      if (timeSinceLastEvent > 45000) {
        es.close();
        eventSourceRef.current = null;
        setSseState(prev => ({
          ...prev,
          error: new Error('SSE Connection Stale'),
          isReconnecting: true,
          failedAttempts: prev.failedAttempts + 1,
        }));
        setIsUsingFallback(true);
      }
    }, 10000);

    return () => {
      clearInterval(livenessCheckInterval);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
    };
  }, [enabled, fetchData, isUsingFallback, projectId, sseEndpoint]);

  return isUsingFallback ? pollingState : sseState;
}
