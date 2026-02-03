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
}

export function useSSE(options: UseSSEOptions = {}): UseSSEState {
  const {
    enabled = true,
    apiUrl = '/api/sse',
    pollingInterval = 2000,
    sessionId,
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
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentSessionIdRef = useRef<string | null | undefined>(sessionId);
  const lastEventTimeRef = useRef<number>(Date.now());

  const pollingState = usePolling({
    enabled: enabled && isUsingFallback,
    interval: pollingInterval,
    apiUrl: '/api/poll',
    sessionId,
  });

  const fetchData = useCallback(async () => {
    const pollUrl = sessionId ? `/api/poll?sessionId=${sessionId}` : '/api/poll';
    try {
      const response = await fetch(pollUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: PollResponse = await response.json();
      
      if (currentSessionIdRef.current === sessionId) {
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
  }, [sessionId]);

  useEffect(() => {
    if (currentSessionIdRef.current !== sessionId) {
      currentSessionIdRef.current = sessionId;
      setSseState(prev => ({
        ...prev,
        loading: true,
        data: prev.data ? { ...prev.data, messages: [], activitySessions: [], sessionStats: null } : null,
      }));
    }
  }, [sessionId]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        setIsUsingFallback(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || isUsingFallback) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    fetchData();

    const sseUrl = sessionId ? `${apiUrl}?sessionId=${sessionId}` : apiUrl;
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
    es.addEventListener('plan-update', handleSSEEvent);
    es.addEventListener('heartbeat', () => {});

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setSseState(prev => ({
        ...prev,
        error: new Error('SSE Connection Failed'),
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
        }));
        setIsUsingFallback(true);
      }
    }, 10000);

    return () => {
      clearInterval(livenessCheckInterval);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
    };
  }, [enabled, isUsingFallback, apiUrl, sessionId, fetchData]);

  return isUsingFallback ? pollingState : sseState;
}
