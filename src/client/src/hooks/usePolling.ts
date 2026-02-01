import { useState, useEffect, useCallback, useRef } from 'react';
import type { SessionMetadata, PlanProgress, MessageMeta, ActivitySession } from '@shared/types';

export interface PollResponse {
  sessions: SessionMetadata[];
  activeSession: SessionMetadata | null;
  planProgress: PlanProgress | null;
  messages: MessageMeta[];
  activitySessions: ActivitySession[];
  lastUpdate: number;
}

interface UsePollingState {
  data: PollResponse | null;
  loading: boolean;
  error: Error | null;
  lastUpdate: number;
  isReconnecting: boolean;
  failedAttempts: number;
}

interface UsePollingOptions {
  interval?: number;
  enabled?: boolean;
  apiUrl?: string;
  maxRetries?: number;
  sessionId?: string | null;
}

export function usePolling(options: UsePollingOptions = {}): UsePollingState {
  const {
    interval = 2000,
    enabled = true,
    apiUrl = '/api/poll',
    maxRetries = 5,
    sessionId,
  } = options;

  const pollUrl = sessionId ? `${apiUrl}?sessionId=${sessionId}` : apiUrl;

  const [state, setState] = useState<UsePollingState>({
    data: null,
    loading: true,
    error: null,
    lastUpdate: 0,
    isReconnecting: false,
    failedAttempts: 0,
  });

  const etagRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const headers: HeadersInit = {};
      
      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const response = await fetch(pollUrl, {
        headers,
        signal: abortController.signal,
      });

      if (response.status === 304) {
        setState(prev => ({
          ...prev,
          loading: false,
          lastUpdate: Date.now(),
          isReconnecting: false,
          failedAttempts: 0,
        }));
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const newETag = response.headers.get('ETag');
      if (newETag) {
        etagRef.current = newETag;
      }

      const data: PollResponse = await response.json();

      setState({
        data,
        loading: false,
        error: null,
        lastUpdate: Date.now(),
        isReconnecting: false,
        failedAttempts: 0,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      setState(prev => {
        const newFailedAttempts = prev.failedAttempts + 1;
        const shouldRetry = newFailedAttempts < maxRetries;

        return {
          ...prev,
          loading: false,
          error: err instanceof Error ? err : new Error('Unknown error'),
          isReconnecting: shouldRetry,
          failedAttempts: newFailedAttempts,
        };
      });

      if (state.failedAttempts + 1 < maxRetries) {
        const backoffDelay = Math.min(1000 * Math.pow(2, state.failedAttempts), 10000);
        retryTimeoutRef.current = setTimeout(() => {
          fetchData();
        }, backoffDelay);
      }
    }
  }, [pollUrl, maxRetries, state.failedAttempts]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    fetchData();

    const intervalId = setInterval(fetchData, interval);

    return () => {
      clearInterval(intervalId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [enabled, interval, fetchData]);

  return state;
}
