/**
 * Core TypeScript types for OCWatch
 * Ported from Go types in internal/state/state.go and internal/parser/parser.go
 */

export type SessionStatus = "working" | "idle" | "completed";

export interface SessionMetadata {
  id: string;
  projectID: string;
  directory: string;
  title: string;
  parentID?: string;
  agent?: string | null;
  modelID?: string | null;
  providerID?: string | null;
  status?: SessionStatus;
  currentAction?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MessageMeta represents a message in a session
 */
export interface MessageMeta {
  id: string;
  sessionID: string;
  role: string;
  agent?: string;
  mode?: string;
  modelID?: string;
  providerID?: string;
  parentID?: string;
  tokens?: number;
  createdAt: Date;
}

/**
 * ActivitySession represents a session in the live activity view
 * Includes agent info and hierarchy
 */
export interface ActivitySession {
  id: string;
  title: string;
  agent: string;
  modelID?: string;
  providerID?: string;
  parentID?: string;
  tokens?: number;
  status?: SessionStatus;
  currentAction?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PartMeta represents a part file (tool call)
 */
export interface ToolInput {
  filePath?: string;
  command?: string;
  pattern?: string;
  url?: string;
  query?: string;
  [key: string]: unknown;
}

export interface PartMeta {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
  callID?: string;
  tool?: string;
  state?: string;
  input?: ToolInput;
  title?: string;
}

/**
 * AgentInfo represents an active agent
 */
export interface AgentInfo {
  name: string;
  mode: string;
  modelID: string;
  active: boolean;
  sessionID: string;
}

/**
 * ToolCall represents a tool invocation
 */
export interface ToolCall {
  id: string;
  name: string;
  state: "pending" | "complete" | "error";
  timestamp: Date;
  sessionID: string;
  messageID: string;
}

/**
 * PlanProgress represents progress on a plan
 */
export interface PlanProgress {
  completed: number;
  total: number;
  progress: number; // 0-100
  tasks: Array<{ description: string; completed: boolean }>;
}

/**
 * Boulder represents the current plan state
 */
export interface Boulder {
  activePlan?: string;
  sessionIDs: string[];
  status: string;
  startedAt: Date;
  planName: string;
}

/**
 * ProjectInfo represents a project with session count
 */
export interface ProjectInfo {
  id: string;
  directory: string;
  sessionCount: number;
}

/**
 * RingBuffer is a generic circular buffer with fixed capacity
 * Automatically drops oldest items when capacity is exceeded
 */
export class RingBuffer<T> {
  private buffer: T[] = [];
  private capacity: number;
  private head: number = 0;

  constructor(capacity: number = 1000) {
    this.capacity = Math.max(1, capacity);
  }

  /**
   * Add an item to the buffer
   * If buffer is full, drops the oldest item
   */
  push(item: T): void {
    if (this.buffer.length < this.capacity) {
      this.buffer.push(item);
    } else {
      this.buffer[this.head] = item;
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Get all items in order (oldest to newest)
   */
  getAll(): T[] {
    if (this.buffer.length < this.capacity) {
      return [...this.buffer];
    }
    // Reconstruct in order when buffer is full
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head),
    ];
  }

  /**
   * Get the last n items (newest first)
   */
  getLatest(n: number): T[] {
    const all = this.getAll();
    return all.slice(Math.max(0, all.length - n)).reverse();
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.buffer = [];
    this.head = 0;
  }

  /**
   * Get current number of items
   */
  get size(): number {
    return this.buffer.length;
  }
}
