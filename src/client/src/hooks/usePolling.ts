import { useState, useEffect, useCallback, useRef } from 'react';
import type { PollResponse } from '@shared/types';
import { useScopedFetch } from './useScopedFetch';

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
  projectId?: string | null;
}

export function usePolling(options: UsePollingOptions = {}): UsePollingState {
  const {
    interval = 2000,
    enabled = true,
    apiUrl = '/api/poll',
    maxRetries = 5,
    projectId,
  } = options;

  const pollUrl = (() => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    const qs = params.toString();
    return qs ? `${apiUrl}?${qs}` : apiUrl;
  })();

  const scopeKey = projectId ?? '';
  const { scopeChanged, createAbortController, isStale, getCurrentScopeKey } = useScopedFetch(scopeKey);

  const [state, setState] = useState<UsePollingState>({
    data: null,
    loading: true,
    error: null,
    lastUpdate: 0,
    isReconnecting: false,
    failedAttempts: 0,
  });

  const etagRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedAttemptsRef = useRef(0);

  if (scopeChanged) {
    etagRef.current = null;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    failedAttemptsRef.current = 0;
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      failedAttempts: 0,
    }));
  }

  const fetchData = useCallback(async () => {
    const fetchScopeKey = getCurrentScopeKey();
    const abortController = createAbortController();

    try {
      const headers: HeadersInit = {};

      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const response = await fetch(pollUrl, {
        headers,
        signal: abortController.signal,
      });

      if (isStale(fetchScopeKey)) {
        return;
      }

      if (response.status === 304) {
        setState(prev => ({
          ...prev,
          loading: false,
          lastUpdate: Date.now(),
          isReconnecting: false,
          failedAttempts: 0,
        }));
        failedAttemptsRef.current = 0;
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

      if (isStale(fetchScopeKey)) {
        return;
      }

      setState({
        data,
        loading: false,
        error: null,
        lastUpdate: Date.now(),
        isReconnecting: false,
        failedAttempts: 0,
      });
      failedAttemptsRef.current = 0;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      if (isStale(fetchScopeKey)) {
        return;
      }

      const newFailedAttempts = failedAttemptsRef.current + 1;
      failedAttemptsRef.current = newFailedAttempts;
      const shouldRetry = newFailedAttempts < maxRetries;

      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err : new Error('Unknown error'),
        isReconnecting: shouldRetry,
        failedAttempts: newFailedAttempts,
      }));

      if (shouldRetry) {
        const backoffDelay = Math.min(1000 * Math.pow(2, newFailedAttempts - 1), 10000);
        retryTimeoutRef.current = setTimeout(() => {
          fetchData();
        }, backoffDelay);
      }
    }
  }, [pollUrl, maxRetries, createAbortController, isStale, getCurrentScopeKey]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    fetchData();

    const intervalId = setInterval(fetchData, interval);

    return () => {
      clearInterval(intervalId);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [enabled, interval, fetchData]);

  return state;
}
