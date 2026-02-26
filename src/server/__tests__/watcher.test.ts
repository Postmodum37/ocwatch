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

    // Create the DB file so the watcher can attach to it
    const dbDir = join(testDir, "opencode");
    await mkdir(dbDir, { recursive: true });
    await writeFile(join(dbDir, "opencode.db"), "");

    // Create .sisyphus dir so boulder watcher can attach
    const sisyphusDir = join(testDir, ".sisyphus");
    await mkdir(sisyphusDir, { recursive: true });

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

  test("detects changes to the database file", async () => {
    let changeDetected = false;
    watcher.on("change", () => {
      changeDetected = true;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Write to the DB file that the watcher monitors
    const dbFile = join(testDir, "opencode", "opencode.db");
    await writeFile(dbFile, "modified");

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(changeDetected).toBe(true);
  });

  test("detects changes to the WAL file when present", async () => {
    // Create WAL file — watcher prefers it over the main DB file
    const walFile = join(testDir, "opencode", "opencode.db-wal");
    await writeFile(walFile, "");

    // Recreate watcher so it picks up the WAL file
    watcher.stop();
    watcher = new Watcher({ storagePath: testDir, projectPath: testDir, debounceMs: 50 });

    let changeDetected = false;
    watcher.on("change", () => {
      changeDetected = true;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    await writeFile(walFile, "modified");

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(changeDetected).toBe(true);
  });

  test("detects changes to boulder.json", async () => {
    let changeDetected = false;
    watcher.on("change", () => {
      changeDetected = true;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const boulderFile = join(testDir, ".sisyphus", "boulder.json");
    await writeFile(boulderFile, JSON.stringify({ activePlan: "plan.md" }));

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(changeDetected).toBe(true);
  });

  test("does not trigger on unrelated file writes", async () => {
    let changeDetected = false;
    watcher.on("change", () => {
      changeDetected = true;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Write to a path that the watcher does NOT monitor
    const unrelatedDir = join(testDir, "unrelated");
    await mkdir(unrelatedDir, { recursive: true });
    await writeFile(join(unrelatedDir, "test.txt"), "test");

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(changeDetected).toBe(false);
  });

  test("debounces rapid changes", async () => {
    let changeCount = 0;
    watcher.on("change", () => {
      changeCount++;
    });

    watcher.start();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const dbFile = join(testDir, "opencode", "opencode.db");

    // Rapid successive writes to the DB file
    await writeFile(dbFile, "change-1");
    await writeFile(dbFile, "change-2");
    await writeFile(dbFile, "change-3");

    await new Promise((resolve) => setTimeout(resolve, 300));
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
