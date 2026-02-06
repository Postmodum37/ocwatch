/**
 * Watcher - File system watcher for OpenCode storage directories
 * Uses fs.watch() to detect changes and trigger cache invalidation
 */

import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { getStoragePath } from "./storage/sessionParser";

export interface WatcherOptions {
  storagePath?: string;
  debounceMs?: number;
}

export class Watcher extends EventEmitter {
  private watchers: FSWatcher[] = [];
  private debounceTimer: Timer | null = null;
  private readonly debounceMs: number;
  private readonly storagePath: string;
  private isRunning: boolean = false;

  constructor(options: WatcherOptions = {}) {
    super();
    this.storagePath = options.storagePath || getStoragePath();
    this.debounceMs = options.debounceMs || 100;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    const sessionDir = join(this.storagePath, "opencode", "storage", "session");
    const messageDir = join(this.storagePath, "opencode", "storage", "message");

    try {
      const sessionWatcher = watch(
        sessionDir,
        { recursive: true },
        this.handleChange.bind(this)
      );
      this.watchers.push(sessionWatcher);

      const messageWatcher = watch(
        messageDir,
        { recursive: true },
        this.handleChange.bind(this)
      );
      this.watchers.push(messageWatcher);

      const partDir = join(this.storagePath, "opencode", "storage", "part");
      try {
        const partWatcher = watch(
          partDir,
          { recursive: true },
          this.handleChange.bind(this)
        );
        this.watchers.push(partWatcher);
      } catch {
        // part directory may not exist yet
      }

      this.emit("started");
    } catch (error) {
      this.emit("error", error);
      this.isRunning = false;
    }
  }

  private handleChange(eventType: string, filename: string | null): void {
    if (!filename) {
      return;
    }

    if (!filename.endsWith(".json")) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.emit("change", { eventType, filename });
      this.debounceTimer = null;
    }, this.debounceMs);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const watcher of this.watchers) {
      watcher.close();
    }

    this.watchers = [];
    this.isRunning = false;
    this.emit("stopped");
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}

export function createWatcher(storagePath?: string): Watcher {
  return new Watcher({ storagePath });
}
