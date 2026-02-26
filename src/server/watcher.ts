import { existsSync, watch, type FSWatcher } from "node:fs";
import { basename, join } from "node:path";
import { EventEmitter } from "node:events";
import { homedir } from "node:os";

export interface WatcherOptions {
  dbPath?: string;
  storagePath?: string;
  projectPath?: string;
  debounceMs?: number;
}

export class Watcher extends EventEmitter {
  private dbWatcher: FSWatcher | null = null;
  private boulderWatcher: FSWatcher | null = null;
  private debounceTimer: Timer | null = null;
  private rebindTimer: Timer | null = null;
  private readonly debounceMs: number;
  private readonly dbPath: string;
  private readonly walPath: string;
  private readonly boulderPath: string;
  private readonly boulderDirPath: string;
  private readonly projectPath: string;
  private dbWatcherTarget: string | null = null;
  private boulderWatcherTarget: string | null = null;
  private isRunning: boolean = false;

  constructor(options: WatcherOptions = {}) {
    super();
    this.dbPath = resolveDbPath(options);
    this.walPath = `${this.dbPath}-wal`;
    this.projectPath = options.projectPath || process.cwd();
    this.boulderPath = join(this.projectPath, ".sisyphus", "boulder.json");
    this.boulderDirPath = join(this.projectPath, ".sisyphus");
    this.debounceMs = options.debounceMs ?? 100;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      this.rebindDbWatcher();
      this.rebindBoulderWatcher();
      this.startRebindLoop();

      this.emit("started");
    } catch (error) {
      this.emit("error", error);
      this.isRunning = false;
    }
  }

  private emitDebouncedChange(eventType: string, filename: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.emit("change", { eventType, filename });
      this.debounceTimer = null;
    }, this.debounceMs);
  }

  private getPreferredDbWatchTarget(): string {
    if (existsSync(this.walPath)) {
      return this.walPath;
    }

    return this.dbPath;
  }

  private rebindDbWatcher(): void {
    const preferredTarget = this.getPreferredDbWatchTarget();
    if (this.dbWatcher && this.dbWatcherTarget === preferredTarget) {
      return;
    }

    if (this.dbWatcher) {
      this.dbWatcher.close();
      this.dbWatcher = null;
      this.dbWatcherTarget = null;
    }

    if (!existsSync(preferredTarget)) {
      return;
    }

    try {
      this.dbWatcher = watch(preferredTarget, (eventType, filename) => {
        this.handleDbEvent(eventType, filename);
      });
      this.dbWatcherTarget = preferredTarget;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return;
      }
      throw error;
    }
  }

  private handleDbEvent(eventType: string, _filename: string | null): void {
    const watchedTarget = this.dbWatcherTarget;
    if (!watchedTarget) {
      return;
    }

    this.emitDebouncedChange(eventType, basename(watchedTarget));

    if (eventType === "rename" || !existsSync(watchedTarget)) {
      this.rebindDbWatcherSafe();
      return;
    }

    if (this.getPreferredDbWatchTarget() !== watchedTarget) {
      this.rebindDbWatcherSafe();
    }
  }

  private rebindBoulderWatcher(): void {
    const preferredTarget = existsSync(this.boulderPath)
      ? this.boulderPath
      : this.boulderDirPath;

    if (this.boulderWatcher && this.boulderWatcherTarget === preferredTarget) {
      return;
    }

    if (this.boulderWatcher) {
      this.boulderWatcher.close();
      this.boulderWatcher = null;
      this.boulderWatcherTarget = null;
    }

    if (!existsSync(preferredTarget)) {
      return;
    }

    this.boulderWatcher = watch(preferredTarget, (eventType, filename) => {
      this.handleBoulderEvent(eventType, filename);
    });
    this.boulderWatcherTarget = preferredTarget;
  }

  private handleBoulderEvent(eventType: string, filename: string | null): void {
    if (this.boulderWatcherTarget === this.boulderDirPath) {
      if (!filename || filename !== "boulder.json") {
        return;
      }
    }

    this.emitDebouncedChange(eventType, ".sisyphus/boulder.json");

    if (eventType === "rename") {
      this.rebindBoulderWatcherSafe();
      return;
    }

    const preferredTarget = existsSync(this.boulderPath)
      ? this.boulderPath
      : this.boulderDirPath;
    if (preferredTarget !== this.boulderWatcherTarget) {
      this.rebindBoulderWatcherSafe();
    }
  }

  private startRebindLoop(): void {
    if (this.rebindTimer) {
      clearInterval(this.rebindTimer);
    }

    this.rebindTimer = setInterval(() => {
      if (!this.isRunning) {
        return;
      }

      this.rebindDbWatcherSafe();
      this.rebindBoulderWatcherSafe();
    }, 1000);
  }

  private rebindDbWatcherSafe(): void {
    try {
      this.rebindDbWatcher();
    } catch {}
  }

  private rebindBoulderWatcherSafe(): void {
    try {
      this.rebindBoulderWatcher();
    } catch {}
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.rebindTimer) {
      clearInterval(this.rebindTimer);
      this.rebindTimer = null;
    }

    if (this.dbWatcher) {
      this.dbWatcher.close();
      this.dbWatcher = null;
      this.dbWatcherTarget = null;
    }

    if (this.boulderWatcher) {
      this.boulderWatcher.close();
      this.boulderWatcher = null;
      this.boulderWatcherTarget = null;
    }

    this.isRunning = false;
    this.emit("stopped");
  }

  close(): void {
    this.stop();
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}

function resolveDbPath(options: WatcherOptions): string {
  if (options.dbPath) {
    return normalizeDbPathInput(options.dbPath);
  }

  if (options.storagePath) {
    return join(options.storagePath, "opencode", "opencode.db");
  }

  const storageRoot = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(storageRoot, "opencode", "opencode.db");
}

function normalizeDbPathInput(dbPathOrStoragePath: string): string {
  if (dbPathOrStoragePath.endsWith(".db")) {
    return dbPathOrStoragePath;
  }

  return join(dbPathOrStoragePath, "opencode", "opencode.db");
}

export function createWatcher(dbPath?: string, projectPath?: string): Watcher {
  return new Watcher({ dbPath, projectPath });
}
