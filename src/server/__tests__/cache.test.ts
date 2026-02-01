import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Cache } from "../cache";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Cache", () => {
  let testDir: string;
  let cache: Cache;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ocwatch-cache-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    const sessionDir = join(testDir, "opencode", "storage", "session", "test-project");
    const messageDir = join(testDir, "opencode", "storage", "message");
    await mkdir(sessionDir, { recursive: true });
    await mkdir(messageDir, { recursive: true });

    cache = new Cache(testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test("markDirty sets dirty flag", () => {
    expect(cache.isStale()).toBe(true);
    cache.markDirty();
    expect(cache.isStale()).toBe(true);
  });

  test("getSessions returns empty array for empty project", async () => {
    const sessions = await cache.getSessions("test-project");
    expect(sessions).toEqual([]);
  });

  test("getSessions caches results", async () => {
    const sessionFile = join(
      testDir,
      "opencode",
      "storage",
      "session",
      "test-project",
      "session-1.json"
    );
    await writeFile(
      sessionFile,
      JSON.stringify({
        id: "session-1",
        slug: "test-session",
        projectID: "test-project",
        directory: "/test",
        title: "Test Session",
        time: {
          created: Date.now(),
          updated: Date.now(),
        },
      })
    );

    const sessions1 = await cache.getSessions("test-project");
    expect(sessions1).toHaveLength(1);
    expect(sessions1[0].id).toBe("session-1");

    const sessions2 = await cache.getSessions("test-project");
    expect(sessions2).toBe(sessions1);
  });

  test("markDirty invalidates cache", async () => {
    const sessionFile = join(
      testDir,
      "opencode",
      "storage",
      "session",
      "test-project",
      "session-1.json"
    );
    await writeFile(
      sessionFile,
      JSON.stringify({
        id: "session-1",
        slug: "test-session",
        projectID: "test-project",
        directory: "/test",
        title: "Test Session",
        time: {
          created: Date.now(),
          updated: Date.now(),
        },
      })
    );

    const sessions1 = await cache.getSessions("test-project");
    expect(sessions1).toHaveLength(1);

    cache.markDirty();
    expect(cache.isStale()).toBe(true);

    const sessions2 = await cache.getSessions("test-project");
    expect(sessions2).not.toBe(sessions1);
  });

  test("TTL expires cache after 2 seconds", async () => {
    const sessionFile = join(
      testDir,
      "opencode",
      "storage",
      "session",
      "test-project",
      "session-1.json"
    );
    await writeFile(
      sessionFile,
      JSON.stringify({
        id: "session-1",
        slug: "test-session",
        projectID: "test-project",
        directory: "/test",
        title: "Test Session",
        time: {
          created: Date.now(),
          updated: Date.now(),
        },
      })
    );

    const sessions1 = await cache.getSessions("test-project");
    expect(sessions1).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 2100));

    const sessions2 = await cache.getSessions("test-project");
    expect(sessions2).not.toBe(sessions1);
  });

  test("getMessages returns empty array for non-existent session", async () => {
    const messages = await cache.getMessages("non-existent");
    expect(messages).toEqual([]);
  });

  test("getMessages caches results", async () => {
    const sessionMessageDir = join(
      testDir,
      "opencode",
      "storage",
      "message",
      "session-1"
    );
    await mkdir(sessionMessageDir, { recursive: true });
    
    const messageFile = join(sessionMessageDir, "message-1.json");
    await writeFile(
      messageFile,
      JSON.stringify({
        id: "message-1",
        sessionID: "session-1",
        role: "user",
        time: {
          created: Date.now(),
        },
      })
    );

    const messages1 = await cache.getMessages("session-1");
    expect(messages1).toHaveLength(1);
    expect(messages1[0].id).toBe("message-1");

    const messages2 = await cache.getMessages("session-1");
    expect(messages2).toBe(messages1);
  });

  test("clear removes all cached data", async () => {
    const sessionFile = join(
      testDir,
      "opencode",
      "storage",
      "session",
      "test-project",
      "session-1.json"
    );
    await writeFile(
      sessionFile,
      JSON.stringify({
        id: "session-1",
        slug: "test-session",
        projectID: "test-project",
        directory: "/test",
        title: "Test Session",
        time: {
          created: Date.now(),
          updated: Date.now(),
        },
      })
    );

    await cache.getSessions("test-project");
    const stats1 = cache.getStats();
    expect(stats1.sessionCacheSize).toBe(1);

    cache.clear();
    const stats2 = cache.getStats();
    expect(stats2.sessionCacheSize).toBe(0);
    expect(stats2.isDirty).toBe(true);
  });

  test("getStats returns cache statistics", async () => {
    const stats = cache.getStats();
    expect(stats).toHaveProperty("sessionCacheSize");
    expect(stats).toHaveProperty("messageCacheSize");
    expect(stats).toHaveProperty("isDirty");
  });
});
