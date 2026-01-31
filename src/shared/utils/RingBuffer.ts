/**
 * RingBuffer - Generic circular buffer with fixed capacity
 * Automatically drops oldest items when capacity is exceeded
 * 
 * Used for storing recent logs and tool calls with a maximum size limit.
 * Ported from Go implementation: internal/state/state.go:50-90
 */

export class RingBuffer<T> {
  private buffer: T[] = [];
  private capacity: number;
  private head: number = 0;

  /**
   * Create a new RingBuffer with specified capacity
   * @param capacity Maximum number of items to store (default: 1000)
   */
  constructor(capacity: number = 1000) {
    this.capacity = Math.max(1, capacity);
  }

  /**
   * Add an item to the buffer
   * If buffer is full, drops the oldest item
   * @param item The item to add
   */
  push(item: T): void {
    if (this.buffer.length < this.capacity) {
      this.buffer.push(item);
    } else {
      // Buffer is full, overwrite oldest item
      this.buffer[this.head] = item;
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /**
   * Get all items in order (oldest to newest)
   * @returns Array of all items in chronological order
   */
  getAll(): T[] {
    if (this.buffer.length < this.capacity) {
      // Buffer not full yet, return as-is
      return [...this.buffer];
    }
    // Buffer is full, reconstruct in order starting from head
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head),
    ];
  }

  /**
   * Get the last n items (newest first)
   * @param n Number of items to retrieve
   * @returns Array of last n items in reverse chronological order
   */
  getLatest(n: number): T[] {
    const all = this.getAll();
    return all.slice(Math.max(0, all.length - n)).reverse();
  }

  /**
   * Clear all items from the buffer
   */
  clear(): void {
    this.buffer = [];
    this.head = 0;
  }

  /**
   * Get current number of items in the buffer
   */
  get size(): number {
    return this.buffer.length;
  }
}
