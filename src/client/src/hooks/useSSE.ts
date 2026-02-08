import { useState, useEffect, useRef, useCallback } from 'react';
import { usePolling } from './usePolling';
import type { PollResponse } from './usePolling';

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
  sessionId?: string | null;
  projectId?: string | null;
}

export function useSSE(options: UseSSEOptions = {}): UseSSEState {
  const {
    enabled = true,
    apiUrl = '/api/sse',
    pollingInterval = 2000,
    sessionId,
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
  const scopeKey = `${sessionId ?? ''}|${projectId ?? ''}`;
  const currentScopeKeyRef = useRef<string>(scopeKey);
  const lastEventTimeRef = useRef<number>(Date.now());

  const pollingState = usePolling({
    enabled: enabled && isUsingFallback,
    interval: pollingInterval,
    apiUrl: '/api/poll',
    sessionId,
    projectId,
  });

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (sessionId) params.set('sessionId', sessionId);
    if (projectId) params.set('projectId', projectId);
    const qs = params.toString();
    const pollUrl = qs ? `/api/poll?${qs}` : '/api/poll';
    try {
      const response = await fetch(pollUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: PollResponse = await response.json();
      
      if (currentScopeKeyRef.current === scopeKey) {
        setSseState(prev => ({
          ...prev,
          data,
          loading: false,
          lastUpdate: Date.now(),
          error: null,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  }, [sessionId, projectId, scopeKey]);

  useEffect(() => {
    if (currentScopeKeyRef.current !== scopeKey) {
      currentScopeKeyRef.current = scopeKey;
      setSseState(prev => ({
        ...prev,
        loading: true,
        data: prev.data ? { ...prev.data, messages: [], activitySessions: [], sessionStats: null } : null,
      }));
    }
  }, [scopeKey]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        setSseState(prev => ({ ...prev, isReconnecting: true }));
        setIsUsingFallback(false);
      }
    };

    const handleOnline = () => {
      if (!enabled) {
        return;
      }
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

    fetchData();

    const sseParams = new URLSearchParams();
    if (sessionId) sseParams.set('sessionId', sessionId);
    if (projectId) sseParams.set('projectId', projectId);
    const sseQs = sseParams.toString();
    const sseUrl = sseQs ? `${apiUrl}?${sseQs}` : apiUrl;
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
    // Heartbeat keeps connection alive but intentionally does NOT reset liveness timer
    // Only meaningful events (session/message/plan updates) should prevent stale detection
    es.addEventListener('heartbeat', () => {});

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
  }, [enabled, isUsingFallback, apiUrl, sessionId, projectId, fetchData]);

  return isUsingFallback ? pollingState : sseState;
}
