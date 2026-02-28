import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { UIStateProvider, useUIState } from '../UIStateContext';
import { PollDataProvider, usePollData } from '../PollDataContext';
import { SessionDetailProvider, useSessionDetail } from '../SessionDetailContext';

// Mock useSSE to prevent real HTTP requests in PollDataProvider
vi.mock('../../hooks/useSSE', () => ({
  useSSE: () => ({
    data: null,
    loading: false,
    error: null,
    lastUpdate: 0,
    isReconnecting: false,
    failedAttempts: 0,
  }),
}));

describe('useUIState', () => {
  it('throws when used outside UIStateProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useUIState())).toThrow(
      'useUIState must be used within UIStateProvider',
    );
    consoleSpy.mockRestore();
  });

  it('returns the expected shape when inside UIStateProvider', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as unknown as typeof fetch;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UIStateProvider>{children}</UIStateProvider>
    );

    const { result } = renderHook(() => useUIState(), { wrapper });

    expect(result.current).toHaveProperty('selectedSessionId');
    expect(result.current).toHaveProperty('selectedProjectId');
    expect(result.current).toHaveProperty('agentFilter');
    expect(result.current).toHaveProperty('projects');
    expect(result.current).toHaveProperty('setSelectedSessionId');
    expect(result.current).toHaveProperty('setSelectedProjectId');
    expect(result.current).toHaveProperty('setAgentFilter');
    expect(typeof result.current.setSelectedSessionId).toBe('function');
    expect(typeof result.current.setSelectedProjectId).toBe('function');
    expect(typeof result.current.setAgentFilter).toBe('function');
    expect(result.current.selectedSessionId).toBeNull();
    expect(Array.isArray(result.current.agentFilter)).toBe(true);
    expect(Array.isArray(result.current.projects)).toBe(true);
  });
});

describe('usePollData', () => {
  it('throws when used outside PollDataProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => usePollData())).toThrow(
      'usePollData must be used within PollDataProvider',
    );
    consoleSpy.mockRestore();
  });

  it('returns the expected shape when inside PollDataProvider', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as unknown as typeof fetch;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UIStateProvider>
        <PollDataProvider>{children}</PollDataProvider>
      </UIStateProvider>
    );

    const { result } = renderHook(() => usePollData(), { wrapper });

    expect(result.current).toHaveProperty('sessions');
    expect(result.current).toHaveProperty('planProgress');
    expect(result.current).toHaveProperty('planName');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('lastUpdate');
    expect(result.current).toHaveProperty('isReconnecting');
    expect(Array.isArray(result.current.sessions)).toBe(true);
    expect(result.current.sessions).toHaveLength(0);
    expect(result.current.planProgress).toBeNull();
  });
});

describe('useSessionDetail', () => {
  it('throws when used outside SessionDetailProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useSessionDetail())).toThrow(
      'useSessionDetail must be used within SessionDetailProvider',
    );
    consoleSpy.mockRestore();
  });

  it('returns the expected shape when inside SessionDetailProvider', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as unknown as typeof fetch;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UIStateProvider>
        <PollDataProvider>
          <SessionDetailProvider>{children}</SessionDetailProvider>
        </PollDataProvider>
      </UIStateProvider>
    );

    const { result } = renderHook(() => useSessionDetail(), { wrapper });

    expect(result.current).toHaveProperty('sessionDetail');
    expect(result.current).toHaveProperty('sessionDetailLoading');
    expect(result.current).toHaveProperty('sessionStats');
    expect(result.current).toHaveProperty('messages');
    expect(result.current).toHaveProperty('activitySessions');
    expect(result.current.sessionDetail).toBeNull();
    expect(result.current.sessionDetailLoading).toBe(false);
    expect(result.current.sessionStats).toBeNull();
    expect(Array.isArray(result.current.messages)).toBe(true);
    expect(Array.isArray(result.current.activitySessions)).toBe(true);
  });
});

describe('context isolation: separate provider boundaries', () => {
  it('UIStateContext and PollDataContext are distinct — UIState consumer does not receive poll data', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as unknown as typeof fetch;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UIStateProvider>
        <PollDataProvider>{children}</PollDataProvider>
      </UIStateProvider>
    );

    // A UIState consumer has no access to poll data fields
    const { result } = renderHook(() => useUIState(), { wrapper });

    expect(result.current).not.toHaveProperty('sessions');
    expect(result.current).not.toHaveProperty('planProgress');
    expect(result.current).not.toHaveProperty('loading');
  });

  it('PollDataContext consumer does not expose UI-only state', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }) as unknown as typeof fetch;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <UIStateProvider>
        <PollDataProvider>{children}</PollDataProvider>
      </UIStateProvider>
    );

    // A PollData consumer has no access to UI state fields
    const { result } = renderHook(() => usePollData(), { wrapper });

    expect(result.current).not.toHaveProperty('selectedSessionId');
    expect(result.current).not.toHaveProperty('selectedProjectId');
    expect(result.current).not.toHaveProperty('agentFilter');
  });
});
