/**
 * Cache - In-memory cache with dirty-flag invalidation
 * Stores parsed sessions/messages with TTL and dirty-flag pattern
 */

import type { SessionMetadata, MessageMeta } from "../shared/types";
import { listSessions } from "./storage/sessionParser";
import { listMessages } from "./storage/messageParser";
import { getStoragePath } from "./storage/sessionParser";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isStale: boolean;
}

/**
 * Cache with dirty-flag invalidation pattern
 * - Marks data stale on file change (dirty flag)
 * - Recomputes on next request if stale
 * - TTL: 2 seconds max (force refresh after 2s even if not dirty)
 */
export class Cache {
  private sessionCache: Map<string, CacheEntry<SessionMetadata[]>> = new Map();
  private messageCache: Map<string, CacheEntry<MessageMeta[]>> = new Map();
  private isDirty: boolean = true;
  private readonly TTL_MS = 2000; // 2 seconds
  private storagePath: string;

  constructor(storagePath?: string) {
    this.storagePath = storagePath || getStoragePath();
  }

  /**
   * Mark all cached data as stale (dirty flag)
   * Called by watcher when file changes detected
   */
  markDirty(): void {
    this.isDirty = true;
    // Mark all entries as stale
    for (const entry of this.sessionCache.values()) {
      entry.isStale = true;
    }
    for (const entry of this.messageCache.values()) {
      entry.isStale = true;
    }
  }

  /**
   * Check if cache is stale (dirty flag set)
   */
  isStale(): boolean {
    return this.isDirty;
  }

  /**
   * Check if a cache entry is expired (TTL exceeded)
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > this.TTL_MS;
  }

  /**
   * Get all sessions for a project
   * Returns cached data if fresh, otherwise recomputes
   */
  async getSessions(projectID: string): Promise<SessionMetadata[]> {
    const cacheKey = projectID;
    const cached = this.sessionCache.get(cacheKey);

    // Return cached data if fresh and not stale
    if (cached && !cached.isStale && !this.isExpired(cached)) {
      return cached.data;
    }

    // Recompute
    const sessions = await listSessions(projectID, this.storagePath);
    this.sessionCache.set(cacheKey, {
      data: sessions,
      timestamp: Date.now(),
      isStale: false,
    });

    // Clear dirty flag after recompute
    this.isDirty = false;

    return sessions;
  }

  /**
   * Get all messages for a session
   * Returns cached data if fresh, otherwise recomputes
   */
  async getMessages(sessionID: string): Promise<MessageMeta[]> {
    const cacheKey = sessionID;
    const cached = this.messageCache.get(cacheKey);

    // Return cached data if fresh and not stale
    if (cached && !cached.isStale && !this.isExpired(cached)) {
      return cached.data;
    }

    // Recompute
    const messages = await listMessages(sessionID, this.storagePath);
    this.messageCache.set(cacheKey, {
      data: messages,
      timestamp: Date.now(),
      isStale: false,
    });

    // Clear dirty flag after recompute
    this.isDirty = false;

    return messages;
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.sessionCache.clear();
    this.messageCache.clear();
    this.isDirty = true;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    sessionCacheSize: number;
    messageCacheSize: number;
    isDirty: boolean;
  } {
    return {
      sessionCacheSize: this.sessionCache.size,
      messageCacheSize: this.messageCache.size,
      isDirty: this.isDirty,
    };
  }
}

/**
 * Singleton cache instance
 */
export const cache = new Cache();
