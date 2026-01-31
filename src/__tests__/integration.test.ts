import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { spawn, type Subprocess } from 'bun';

describe('Integration Tests', () => {
  let serverProcess: Subprocess | null = null;
  const SERVER_PORT = 50234;
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
    
    const data = await response.json();
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
    
    const data = await response.json();
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
});
