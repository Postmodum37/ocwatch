import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionActivityResponse } from '@shared/types';
import { resolveApiPath } from './resolveApiEndpoint';
import { useScopedFetch } from './useScopedFetch';

interface UseSelectedActivityGraphOptions {
  selectedSessionId: string | null;
  apiUrl?: string;
  projectId?: string | null;
  refreshToken: number;
}

interface UseSelectedActivityGraphState {
  data: SessionActivityResponse | null;
  loading: boolean;
  error: Error | null;
}

export function useSelectedActivityGraph({
  selectedSessionId,
  apiUrl,
  projectId,
  refreshToken,
}: UseSelectedActivityGraphOptions): UseSelectedActivityGraphState {
  const scopeKey = `${projectId ?? ''}:${selectedSessionId ?? ''}`;
  const previousScopeKeyRef = useRef(scopeKey);
  const etagRef = useRef<string | null>(null);
  const lastRefreshTokenRef = useRef<number>(refreshToken);
  const { createAbortController, getCurrentScopeKey, isStale } = useScopedFetch(scopeKey);

  const [state, setState] = useState<UseSelectedActivityGraphState>({
    data: null,
    loading: false,
    error: null,
  });

  const fetchGraph = useCallback(async (isBackgroundRefresh: boolean) => {
    if (!selectedSessionId) {
      return;
    }

    const fetchScopeKey = getCurrentScopeKey();
    const controller = createAbortController();

    if (!isBackgroundRefresh) {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));
    }

    try {
      const headers: HeadersInit = {};
      if (etagRef.current) {
        headers['If-None-Match'] = etagRef.current;
      }

      const response = await fetch(
        resolveApiPath(apiUrl, `/api/sessions/${selectedSessionId}/activity`),
        {
          headers,
          signal: controller.signal,
        },
      );

      if (isStale(fetchScopeKey)) {
        return;
      }

      if (response.status === 304) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
        }));
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const nextEtag = response.headers.get('ETag');
      if (nextEtag) {
        etagRef.current = nextEtag;
      }

      const data: SessionActivityResponse = await response.json();
      if (isStale(fetchScopeKey)) {
        return;
      }

      setState({
        data,
        loading: false,
        error: null,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      if (isStale(fetchScopeKey)) {
        return;
      }

      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err : new Error('Unknown error'),
      }));
    }
  }, [apiUrl, createAbortController, getCurrentScopeKey, isStale, selectedSessionId]);

  useEffect(() => {
    if (previousScopeKeyRef.current === scopeKey) {
      return;
    }

    previousScopeKeyRef.current = scopeKey;
    etagRef.current = null;
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, [scopeKey]);

  useEffect(() => {
    if (!selectedSessionId) {
      etagRef.current = null;
      setState({
        data: null,
        loading: false,
        error: null,
      });
      return;
    }

    lastRefreshTokenRef.current = refreshToken;
    void fetchGraph(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId, fetchGraph]);

  useEffect(() => {
    if (!selectedSessionId) {
      return;
    }

    if (refreshToken === 0 || refreshToken === lastRefreshTokenRef.current) {
      return;
    }

    lastRefreshTokenRef.current = refreshToken;
    void fetchGraph(true);
  }, [selectedSessionId, refreshToken, fetchGraph]);

  return state;
}
