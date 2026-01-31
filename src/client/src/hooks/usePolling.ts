import { useState, useEffect, useCallback, useRef } from 'react';
import type { SessionMetadata, PlanProgress } from '@shared/types';

/**
 * Response from /api/poll endpoint
 */
export interface PollResponse {
  sessions: SessionMetadata[];
  activeSession: SessionMetadata | null;
  planProgress: PlanProgress | null;
  lastUpdate: number;
}

/**
 * Hook state
 */
interface UsePollingState {
  data: PollResponse | null;
  loading: boolean;
  error: Error | null;
  lastUpdate: number;
}

/**
 * Polling configuration
 */
interface UsePollingOptions {
  interval?: number; // milliseconds, default 2000
  enabled?: boolean; // default true
  apiUrl?: string; // default '/api/poll'
}

/**
 * Custom hook for polling /api/poll endpoint with ETag support
 * 
 * Features:
 * - Polls every 2 seconds (configurable)
 * - ETag caching (sends If-None-Match header)
 * - Handles 304 Not Modified responses
 * - Automatic cleanup on unmount
 * 
 * @param options - Polling configuration
 * @returns { data, loading, error, lastUpdate }
 */
export function usePolling(options: UsePollingOptions = {}): UsePollingState {
  const {
    interval = 2000,
    enabled = true,
    apiUrl = '/api/poll',
  } = options;

  const [state, setState] = useState<UsePollingState>({
    data: null,
    loading: true,
    error: null,
    lastUpdate: 0,
  });

  // Store ETag in ref to persist across renders
  const etagRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch data from API with ETag support
   */
  const fetchData = useCallback(async () => {
    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const headers: HeadersInit = {};
      
      // Send If-None-Match header if we have an ETag
      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const response = await fetch(apiUrl, {
        headers,
        signal: abortController.signal,
      });

      // Handle 304 Not Modified - data hasn't changed
      if (response.status === 304) {
        setState(prev => ({
          ...prev,
          loading: false,
          lastUpdate: Date.now(),
        }));
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Store new ETag for next request
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
      });
    } catch (err) {
      // Ignore abort errors (expected when component unmounts)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err : new Error('Unknown error'),
      }));
    }
  }, [apiUrl]);

  /**
   * Set up polling interval
   */
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
    };
  }, [enabled, interval, fetchData]);

  return state;
}
