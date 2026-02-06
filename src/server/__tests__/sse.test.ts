import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { app } from "../index";
import { getGlobalWatcher } from "../routes/sse";

async function readEventChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value } = await reader.read();
  return new TextDecoder().decode(value);
}

describe("GET /api/sse", () => {
  let watcher: ReturnType<typeof getGlobalWatcher>;

  beforeEach(() => {
    watcher = getGlobalWatcher();
  });

  afterEach(() => {
    if (watcher) {
      watcher.stop();
    }
  });

  it("should return 200 with text/event-stream content type", async () => {
    const req = new Request("http://localhost:50234/api/sse");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("should send connected event on connection", async () => {
    const req = new Request("http://localhost:50234/api/sse");
    const res = await app.fetch(req);

    expect(res.ok).toBe(true);
    expect(res.body).toBeTruthy();

    const reader = res.body?.getReader();
    expect(reader).toBeTruthy();

    if (reader) {
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toContain("event: connected");
      expect(text).toContain("connected");
    }
  });

  it("should have proper SSE format with event and data fields", async () => {
    const req = new Request("http://localhost:50234/api/sse");
    const res = await app.fetch(req);

    expect(res.ok).toBe(true);
    const reader = res.body?.getReader();

    if (reader) {
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toMatch(/event: \w+/);
      expect(text).toMatch(/data: \{.*\}/);
    }
  });

  it("should emit session-update event for session file changes", async () => {
    const req = new Request("http://localhost:50234/api/sse");
    const res = await app.fetch(req);

    expect(res.ok).toBe(true);

    const reader = res.body?.getReader();
    if (reader) {
      const connected = await readEventChunk(reader);
      expect(connected).toContain("event: connected");

      watcher.emit("change", {
        eventType: "change",
        filename: "session/abc123.json",
      });

      const update = await readEventChunk(reader);
      expect(update).toContain("event: session-update");
      expect(update).toContain("session/abc123.json");
      await reader.cancel();
    }
  });

  it("should emit message-update event for message file changes", async () => {
    const req = new Request("http://localhost:50234/api/sse");
    const res = await app.fetch(req);

    expect(res.ok).toBe(true);

    const reader = res.body?.getReader();
    if (reader) {
      const connected = await readEventChunk(reader);
      expect(connected).toContain("event: connected");

      watcher.emit("change", {
        eventType: "change",
        filename: "message/msg123.json",
      });

      const update = await readEventChunk(reader);
      expect(update).toContain("event: message-update");
      expect(update).toContain("message/msg123.json");
      await reader.cancel();
    }
  });

  it("should emit plan-update event for boulder file changes", async () => {
    const req = new Request("http://localhost:50234/api/sse");
    const res = await app.fetch(req);

    expect(res.ok).toBe(true);

    const reader = res.body?.getReader();
    if (reader) {
      const connected = await readEventChunk(reader);
      expect(connected).toContain("event: connected");

      watcher.emit("change", {
        eventType: "change",
        filename: ".sisyphus/boulder.json",
      });

      const update = await readEventChunk(reader);
      expect(update).toContain("event: plan-update");
      expect(update).toContain("boulder.json");
      await reader.cancel();
    }
  });

  it("should have proper response headers for SSE", async () => {
    const req = new Request("http://localhost:50234/api/sse");
    const res = await app.fetch(req);

    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
    expect(res.headers.get("Connection")).toContain("keep-alive");
  });
});
