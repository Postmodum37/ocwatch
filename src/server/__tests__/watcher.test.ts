import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Watcher, createWatcher } from "../watcher";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Watcher", () => {
  let testDir: string;
  let watcher: Watcher;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ocwatch-watcher-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    const sessionDir = join(testDir, "opencode", "storage", "session");
    const messageDir = join(testDir, "opencode", "storage", "message");
    await mkdir(sessionDir, { recursive: true });
    await mkdir(messageDir, { recursive: true });

    watcher = new Watcher({ storagePath: testDir, projectPath: testDir, debounceMs: 50 });
  });

  afterEach(async () => {
    watcher.stop();
    await rm(testDir, { recursive: true, force: true });
  });

  test("createWatcher factory function", () => {
    const w = createWatcher(testDir);
    expect(w).toBeInstanceOf(Watcher);
    w.stop();
  });

  test("start emits started event", async () => {
    let started = false;
    watcher.on("started", () => {
      started = true;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(started).toBe(true);
  });

  test("stop emits stopped event", async () => {
    let stopped = false;
    watcher.on("stopped", () => {
      stopped = true;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 10));
    watcher.stop();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(stopped).toBe(true);
  });

  test("detects file changes in session directory", async () => {
    let changeDetected = false;
    watcher.on("change", () => {
      changeDetected = true;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const projectDir = join(
      testDir,
      "opencode",
      "storage",
      "session",
      "test-project"
    );
    await mkdir(projectDir, { recursive: true });
    
    const sessionFile = join(projectDir, "test.json");
    await writeFile(sessionFile, JSON.stringify({ test: true }));

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(changeDetected).toBe(true);
  });

  test("detects file changes in message directory", async () => {
    let changeDetected = false;
    watcher.on("change", () => {
      changeDetected = true;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const messageFile = join(
      testDir,
      "opencode",
      "storage",
      "message",
      "test.json"
    );
    await writeFile(messageFile, JSON.stringify({ test: true }));

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(changeDetected).toBe(true);
  });

  test("detects file changes in boulder directory", async () => {
    let changeDetected = false;
    watcher.on("change", () => {
      changeDetected = true;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const boulderDir = join(testDir, ".sisyphus");
    await mkdir(boulderDir, { recursive: true });

    const boulderFile = join(boulderDir, "boulder.json");
    await writeFile(boulderFile, JSON.stringify({ activePlan: "plan.md" }));

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(changeDetected).toBe(true);
  });

  test("ignores non-JSON files", async () => {
    let changeDetected = false;
    watcher.on("change", () => {
      changeDetected = true;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const textFile = join(
      testDir,
      "opencode",
      "storage",
      "session",
      "test.txt"
    );
    await writeFile(textFile, "test");

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(changeDetected).toBe(false);
  });

  test("debounces rapid changes", async () => {
    let changeCount = 0;
    watcher.on("change", () => {
      changeCount++;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const projectDir = join(
      testDir,
      "opencode",
      "storage",
      "session",
      "test-project"
    );
    await mkdir(projectDir, { recursive: true });

    const sessionFile = join(
      projectDir,
      "test.json"
    );

    await writeFile(sessionFile, JSON.stringify({ test: 1 }));
    await writeFile(sessionFile, JSON.stringify({ test: 2 }));
    await writeFile(sessionFile, JSON.stringify({ test: 3 }));

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(changeCount).toBeGreaterThan(0);
    expect(changeCount).toBeLessThanOrEqual(2);
  });

  test("getIsRunning returns correct state", () => {
    expect(watcher.getIsRunning()).toBe(false);
    watcher.start();
    expect(watcher.getIsRunning()).toBe(true);
    watcher.stop();
    expect(watcher.getIsRunning()).toBe(false);
  });

  test("start is idempotent", () => {
    watcher.start();
    expect(watcher.getIsRunning()).toBe(true);
    watcher.start();
    expect(watcher.getIsRunning()).toBe(true);
  });

  test("stop is idempotent", () => {
    watcher.start();
    watcher.stop();
    expect(watcher.getIsRunning()).toBe(false);
    watcher.stop();
    expect(watcher.getIsRunning()).toBe(false);
  });
});
