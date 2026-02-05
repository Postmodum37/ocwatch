import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn, type Subprocess } from 'bun';
import { DEFAULT_PORT } from '../shared/constants';

describe('Integration Tests', () => {
  let serverProcess: Subprocess | null = null;
  const SERVER_PORT = DEFAULT_PORT;
  const SERVER_URL = `http://localhost:${SERVER_PORT}`;

  beforeAll(async () => {
    serverProcess = spawn({
      cmd: ['bun', 'run', 'src/server/index.ts', '--no-browser'],
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('server starts and health endpoint responds', async () => {
    const response = await fetch(`${SERVER_URL}/api/health`);
    expect(response.status).toBe(200);
    
    const data = await response.json() as { status: string };
    expect(data.status).toBe('ok');
  });

  it('sessions endpoint returns array', async () => {
    const response = await fetch(`${SERVER_URL}/api/sessions`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('projects endpoint returns array', async () => {
    const response = await fetch(`${SERVER_URL}/api/projects`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('plan endpoint returns object or null', async () => {
    const response = await fetch(`${SERVER_URL}/api/plan`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data === null || typeof data === 'object').toBe(true);
  });

  it('poll endpoint returns expected structure', async () => {
    const response = await fetch(`${SERVER_URL}/api/poll`);
    expect(response.status).toBe(200);
    
    const data = await response.json() as { sessions: unknown[]; activeSession: unknown; planProgress: unknown; lastUpdate: number };
    expect(data).toHaveProperty('sessions');
    expect(data).toHaveProperty('activeSession');
    expect(data).toHaveProperty('planProgress');
    expect(data).toHaveProperty('lastUpdate');
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  it('poll endpoint includes ETag header', async () => {
    const response = await fetch(`${SERVER_URL}/api/poll`);
    expect(response.status).toBe(200);
    
    const etag = response.headers.get('ETag');
    expect(etag).not.toBeNull();
  });

  it('poll endpoint returns 304 with matching ETag', async () => {
    const firstResponse = await fetch(`${SERVER_URL}/api/poll`);
    const etag = firstResponse.headers.get('ETag');
    
    const secondResponse = await fetch(`${SERVER_URL}/api/poll`, {
      headers: {
        'If-None-Match': etag || '',
      },
    });
    
    expect(secondResponse.status).toBe(304);
  });

  it('static files are served', async () => {
    const response = await fetch(`${SERVER_URL}/`);
    expect(response.status).toBe(200);
    
    const html = await response.text();
    expect(html.toLowerCase()).toContain('<!doctype html>');
  });

  it('GET /api/poll returns ETag and supports 304', async () => {
    const res1 = await fetch(`${SERVER_URL}/api/poll`);
    expect(res1.status).toBe(200);
    const etag = res1.headers.get('ETag');
    expect(etag).toBeTruthy();

    const res2 = await fetch(`${SERVER_URL}/api/poll`, {
      headers: { 'If-None-Match': etag! },
    });
    expect(res2.status).toBe(304);
  });

  it('GET /api/sse returns event-stream content type', async () => {
    const res = await fetch(`${SERVER_URL}/api/sse`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    await res.body?.cancel();
  });

  it('GET /api/poll returns complete response shape', async () => {
    const res = await fetch(`${SERVER_URL}/api/poll`);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data).toHaveProperty('sessions');
    expect(data).toHaveProperty('activeSession');
    expect(data).toHaveProperty('planProgress');
    expect(data).toHaveProperty('messages');
    expect(data).toHaveProperty('activitySessions');
    expect(data).toHaveProperty('lastUpdate');
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(Array.isArray(data.messages)).toBe(true);
    expect(Array.isArray(data.activitySessions)).toBe(true);
    expect(typeof data.lastUpdate).toBe('number');
  });

  it('GET /api/projects returns array', async () => {
    const res = await fetch(`${SERVER_URL}/api/projects`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('GET /api/sessions/invalid-id returns error', async () => {
    const res = await fetch(`${SERVER_URL}/api/sessions/nonexistent-session-id`);
    expect([400, 404]).toContain(res.status);
  });
});
