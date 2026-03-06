import { describe, it, expect } from 'bun:test';
import { app } from '../server/index';

describe('Integration Tests', () => {
  it('server responds on health endpoint', async () => {
    const response = await app.fetch(new Request('http://localhost:50234/api/health'));
    expect(response.status).toBe(200);

    const data = await response.json() as { status: string };
    expect(data.status).toBe('ok');
  });

  it('sessions endpoint returns array', async () => {
    const response = await app.fetch(new Request('http://localhost:50234/api/sessions'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('projects endpoint returns array', async () => {
    const response = await app.fetch(new Request('http://localhost:50234/api/projects'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('plan endpoint returns object or null', async () => {
    const response = await app.fetch(new Request('http://localhost:50234/api/plan'));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data === null || typeof data === 'object').toBe(true);
  });

  it('poll endpoint returns expected structure', async () => {
    const response = await app.fetch(new Request('http://localhost:50234/api/poll'));
    expect(response.status).toBe(200);

    const data = await response.json() as { sessions: unknown[]; activeSessionId: string | null; planProgress: unknown; lastUpdate: number };
    expect(data).toHaveProperty('sessions');
    expect(data).toHaveProperty('activeSessionId');
    expect(data).toHaveProperty('planProgress');
    expect(data).toHaveProperty('lastUpdate');
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  it('poll endpoint supports ETag / 304', async () => {
    const firstResponse = await app.fetch(new Request('http://localhost:50234/api/poll'));
    const etag = firstResponse.headers.get('ETag');
    expect(etag).toBeTruthy();

    const secondResponse = await app.fetch(new Request('http://localhost:50234/api/poll', {
      headers: {
        'If-None-Match': etag || '',
      },
    }));

    expect(secondResponse.status).toBe(304);
  });

  it('static files are served', async () => {
    const response = await app.fetch(new Request('http://localhost:50234/'));
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html.toLowerCase()).toContain('<!doctype html>');
  });

  it('sse endpoint returns event-stream content type', async () => {
    const response = await app.fetch(new Request('http://localhost:50234/api/sse'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    await response.body?.cancel();
  });

  it('session detail endpoint returns expected shape when a session exists', async () => {
    const pollResponse = await app.fetch(new Request('http://localhost:50234/api/poll'));
    const pollData = await pollResponse.json() as { sessions: Array<{ id: string }> };

    if (pollData.sessions.length === 0) {
      return;
    }

    const sessionId = pollData.sessions[0].id;
    const response = await app.fetch(new Request(`http://localhost:50234/api/sessions/${sessionId}`));
    expect([200, 404]).toContain(response.status);

    if (response.status === 200) {
      const data = await response.json() as Record<string, unknown>;
      expect(data).toHaveProperty('session');
      expect(data).toHaveProperty('messages');
      expect(data).toHaveProperty('activity');
      expect(data).toHaveProperty('todos');
    }
  });
});
