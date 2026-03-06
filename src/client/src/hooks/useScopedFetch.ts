import { useEffect, useRef, useCallback } from 'react';

/**
 * Manages scope key tracking and AbortController lifecycle for fetch hooks.
 * Aborts in-flight requests when the scope changes or on unmount.
 */
export function useScopedFetch(scopeKey: string) {
  const currentScopeKeyRef = useRef(scopeKey);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    currentScopeKeyRef.current = scopeKey;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [scopeKey]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const createAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    return controller;
  }, []);

  const isStale = useCallback((fetchScopeKey: string) => {
    return currentScopeKeyRef.current !== fetchScopeKey;
  }, []);

  const getCurrentScopeKey = useCallback(() => {
    return currentScopeKeyRef.current;
  }, []);

  return { createAbortController, isStale, getCurrentScopeKey };
}
