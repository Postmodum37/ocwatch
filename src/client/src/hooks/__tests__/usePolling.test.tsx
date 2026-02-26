import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePolling } from '../usePolling';
import type { PollResponse } from '@shared/types';

const mockPollResponse: PollResponse = {
  sessions: [
    {
      id: 'test-session-1',
      projectID: 'test-project',
      title: 'Test Session',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  activeSessionId: null,
  planProgress: null,
  lastUpdate: Date.now(),
};

function createSuccessResponse(data: PollResponse, etag: string): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ETag: etag,
    },
  });
}

describe('usePolling', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches data immediately on mount', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'ETag': '"test-etag"' }),
      json: async () => mockPollResponse,
    });

    const { result } = renderHook(() => usePolling({ interval: 2000 }));

    expect(result.current.loading).toBe(true);

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 1000 }
    );

    expect(result.current.data).toEqual(mockPollResponse);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('polls at specified interval', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'ETag': '"test-etag"' }),
      json: async () => mockPollResponse,
    });

    renderHook(() => usePolling({ interval: 100 }));

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 250));
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('sends If-None-Match header with ETag on subsequent requests', async () => {
    const testETag = '"test-etag-123"';

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'ETag': testETag }),
        json: async () => mockPollResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'ETag': testETag }),
        json: async () => mockPollResponse,
      });

    renderHook(() => usePolling({ interval: 100 }));

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      },
      { timeout: 1000 }
    );

    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall[1].headers['If-None-Match']).toBe(testETag);
  });

  it('handles 304 Not Modified response', async () => {
    const testETag = '"test-etag-304"';

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'ETag': testETag }),
        json: async () => mockPollResponse,
      })
      .mockResolvedValue({
        status: 304,
        headers: new Headers({ 'ETag': testETag }),
      });

    const { result, unmount } = renderHook(() => usePolling({ interval: 100 }));

    await waitFor(
      () => {
        expect(result.current.data).toEqual(mockPollResponse);
      },
      { timeout: 1000 }
    );

    const firstData = result.current.data;

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(result.current.data).toBe(firstData);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/poll',
      expect.objectContaining({
        headers: expect.objectContaining({
          'If-None-Match': testETag,
        }),
      })
    );

    unmount();
  });

  it('handles fetch errors', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePolling({ interval: 2000, maxRetries: 0 }));

    await waitFor(
      () => {
        expect(result.current.error).not.toBeNull();
      },
      { timeout: 1000 }
    );

    expect(result.current.error?.message).toBe('Network error');
    expect(result.current.loading).toBe(false);
  });

  it('handles HTTP error responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { result } = renderHook(() => usePolling({ interval: 2000, maxRetries: 0 }));

    await waitFor(
      () => {
        expect(result.current.error).not.toBeNull();
      },
      { timeout: 1000 }
    );

    expect(result.current.error?.message).toContain('500');
    expect(result.current.loading).toBe(false);
  });

  it('cleans up interval on unmount', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'ETag': '"test-etag"' }),
      json: async () => mockPollResponse,
    });

    const { unmount } = renderHook(() => usePolling({ interval: 100 }));

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );

    unmount();

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('respects enabled option', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'ETag': '"test-etag"' }),
      json: async () => mockPollResponse,
    });

    renderHook(() => usePolling({ interval: 100, enabled: false }));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses custom API URL', async () => {
    const customUrl = '/custom/api/endpoint';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'ETag': '"test-etag"' }),
      json: async () => mockPollResponse,
    });

    renderHook(() => usePolling({ apiUrl: customUrl }));

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          customUrl,
          expect.any(Object)
        );
      },
      { timeout: 1000 }
    );
  });

  it('includes projectId query parameter when provided', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'ETag': '"test-etag"' }),
      json: async () => mockPollResponse,
    });

    renderHook(() => usePolling({ projectId: 'project-alpha' }));

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/poll?projectId=project-alpha',
          expect.any(Object)
        );
      },
      { timeout: 1000 }
    );
  });

  it('resets ETag and loading state when projectId scope changes', async () => {
    const alphaResponse: PollResponse = {
      ...mockPollResponse,
      sessions: [{ ...mockPollResponse.sessions[0], projectID: 'project-alpha' }],
    };
    const betaResponse: PollResponse = {
      ...mockPollResponse,
      sessions: [{ ...mockPollResponse.sessions[0], projectID: 'project-beta' }],
    };

    let resolveSecondResponse!: (value: Response) => void;
    const secondResponsePromise = new Promise<Response>((resolve) => {
      resolveSecondResponse = resolve;
    });

    fetchMock
      .mockResolvedValueOnce(createSuccessResponse(alphaResponse, '"alpha-etag"'))
      .mockImplementationOnce(() => secondResponsePromise);

    const { result, rerender } = renderHook(
      ({ projectId }) => usePolling({ interval: 2000, projectId }),
      { initialProps: { projectId: 'project-alpha' } }
    );

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 1000 }
    );

    rerender({ projectId: 'project-beta' });

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      },
      { timeout: 1000 }
    );

    await waitFor(
      () => {
        expect(result.current.loading).toBe(true);
      },
      { timeout: 1000 }
    );

    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall[0]).toBe('/api/poll?projectId=project-beta');
    expect(secondCall[1].headers).not.toHaveProperty('If-None-Match');

    resolveSecondResponse(createSuccessResponse(betaResponse, '"beta-etag"'));

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 1000 }
    );
    expect(result.current.data?.sessions[0]?.projectID).toBe('project-beta');
  });

  it('discards stale response from previous projectId scope', async () => {
    const alphaResponse: PollResponse = {
      ...mockPollResponse,
      sessions: [{ ...mockPollResponse.sessions[0], id: 'alpha-session', projectID: 'project-alpha' }],
    };
    const betaResponse: PollResponse = {
      ...mockPollResponse,
      sessions: [{ ...mockPollResponse.sessions[0], id: 'beta-session', projectID: 'project-beta' }],
    };

    let resolveAlphaResponse!: (value: Response) => void;
    const alphaResponsePromise = new Promise<Response>((resolve) => {
      resolveAlphaResponse = resolve;
    });

    fetchMock
      .mockImplementationOnce(() => alphaResponsePromise)
      .mockResolvedValueOnce(createSuccessResponse(betaResponse, '"beta-etag"'));

    const { result, rerender } = renderHook(
      ({ projectId }) => usePolling({ interval: 2000, projectId }),
      { initialProps: { projectId: 'project-alpha' } }
    );

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );

    rerender({ projectId: 'project-beta' });

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      },
      { timeout: 1000 }
    );

    await waitFor(
      () => {
        expect(result.current.data?.sessions[0]?.id).toBe('beta-session');
      },
      { timeout: 1000 }
    );

    resolveAlphaResponse(createSuccessResponse(alphaResponse, '"alpha-etag"'));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.data?.sessions[0]?.id).toBe('beta-session');
    expect(result.current.data?.sessions[0]?.projectID).toBe('project-beta');
  });
});
