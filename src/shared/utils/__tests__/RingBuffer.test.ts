import { describe, it, expect, beforeEach } from "bun:test";
import { RingBuffer } from "../RingBuffer";

describe("RingBuffer", () => {
  let buffer: RingBuffer<number>;

  beforeEach(() => {
    buffer = new RingBuffer<number>(3);
  });

  describe("constructor", () => {
    it("should create buffer with default capacity of 1000", () => {
      const defaultBuffer = new RingBuffer<string>();
      expect(defaultBuffer.size).toBe(0);
    });

    it("should create buffer with custom capacity", () => {
      const customBuffer = new RingBuffer<number>(5);
      expect(customBuffer.size).toBe(0);
    });

    it("should enforce minimum capacity of 1", () => {
      const minBuffer = new RingBuffer<number>(0);
      minBuffer.push(1);
      expect(minBuffer.size).toBe(1);
    });
  });

  describe("push", () => {
    it("should add items to empty buffer", () => {
      buffer.push(1);
      expect(buffer.size).toBe(1);
      expect(buffer.getAll()).toEqual([1]);
    });

    it("should add multiple items in order", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      expect(buffer.size).toBe(3);
      expect(buffer.getAll()).toEqual([1, 2, 3]);
    });

    it("should drop oldest item when capacity exceeded", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4); // Should drop 1
      expect(buffer.size).toBe(3);
      expect(buffer.getAll()).toEqual([2, 3, 4]);
    });

    it("should maintain circular order after multiple overwrites", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4); // Overwrites 1
      buffer.push(5); // Overwrites 2
      buffer.push(6); // Overwrites 3
      expect(buffer.getAll()).toEqual([4, 5, 6]);
    });

    it("should handle large number of pushes", () => {
      for (let i = 1; i <= 100; i++) {
        buffer.push(i);
      }
      expect(buffer.size).toBe(3);
      expect(buffer.getAll()).toEqual([98, 99, 100]);
    });

    it("should work with different data types", () => {
      const stringBuffer = new RingBuffer<string>(2);
      stringBuffer.push("a");
      stringBuffer.push("b");
      stringBuffer.push("c");
      expect(stringBuffer.getAll()).toEqual(["b", "c"]);
    });

    it("should work with objects", () => {
      const objBuffer = new RingBuffer<{ id: number; name: string }>(2);
      objBuffer.push({ id: 1, name: "first" });
      objBuffer.push({ id: 2, name: "second" });
      objBuffer.push({ id: 3, name: "third" });
      const all = objBuffer.getAll();
      expect(all.length).toBe(2);
      expect(all[0].id).toBe(2);
      expect(all[1].id).toBe(3);
    });
  });

  describe("getAll", () => {
    it("should return empty array for empty buffer", () => {
      expect(buffer.getAll()).toEqual([]);
    });

    it("should return items in order when buffer not full", () => {
      buffer.push(1);
      buffer.push(2);
      expect(buffer.getAll()).toEqual([1, 2]);
    });

    it("should return items in correct order when buffer is full", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);
      expect(buffer.getAll()).toEqual([2, 3, 4]);
    });

    it("should return new array (not reference)", () => {
      buffer.push(1);
      buffer.push(2);
      const first = buffer.getAll();
      const second = buffer.getAll();
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
    });

    it("should maintain order through multiple cycles", () => {
      for (let cycle = 0; cycle < 3; cycle++) {
        buffer.clear();
        buffer.push(cycle * 10 + 1);
        buffer.push(cycle * 10 + 2);
        buffer.push(cycle * 10 + 3);
        buffer.push(cycle * 10 + 4);
        const expected = [cycle * 10 + 2, cycle * 10 + 3, cycle * 10 + 4];
        expect(buffer.getAll()).toEqual(expected);
      }
    });
  });

  describe("getLatest", () => {
    it("should return empty array when buffer is empty", () => {
      expect(buffer.getLatest(5)).toEqual([]);
    });

    it("should return items in reverse order", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      expect(buffer.getLatest(3)).toEqual([3, 2, 1]);
    });

    it("should return only requested number of items", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      expect(buffer.getLatest(2)).toEqual([3, 2]);
    });

    it("should handle n greater than buffer size", () => {
      buffer.push(1);
      buffer.push(2);
      expect(buffer.getLatest(10)).toEqual([2, 1]);
    });

    it("should return single item when n=1", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      expect(buffer.getLatest(1)).toEqual([3]);
    });

    it("should return correct items after buffer wraps", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);
      buffer.push(5);
      expect(buffer.getLatest(2)).toEqual([5, 4]);
    });

    it("should handle n=0", () => {
      buffer.push(1);
      buffer.push(2);
      expect(buffer.getLatest(0)).toEqual([]);
    });
  });

  describe("clear", () => {
    it("should empty the buffer", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.clear();
      expect(buffer.size).toBe(0);
      expect(buffer.getAll()).toEqual([]);
    });

    it("should reset head pointer", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);
      buffer.clear();
      buffer.push(5);
      expect(buffer.getAll()).toEqual([5]);
    });

    it("should allow reuse after clear", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.clear();
      buffer.push(10);
      buffer.push(20);
      expect(buffer.getAll()).toEqual([10, 20]);
    });

    it("should work on empty buffer", () => {
      buffer.clear();
      expect(buffer.size).toBe(0);
    });
  });

  describe("size getter", () => {
    it("should return 0 for empty buffer", () => {
      expect(buffer.size).toBe(0);
    });

    it("should return correct size when adding items", () => {
      buffer.push(1);
      expect(buffer.size).toBe(1);
      buffer.push(2);
      expect(buffer.size).toBe(2);
      buffer.push(3);
      expect(buffer.size).toBe(3);
    });

    it("should return capacity when buffer is full", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);
      expect(buffer.size).toBe(3);
    });

    it("should return 0 after clear", () => {
      buffer.push(1);
      buffer.push(2);
      buffer.clear();
      expect(buffer.size).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle capacity of 1", () => {
      const singleBuffer = new RingBuffer<number>(1);
      singleBuffer.push(1);
      expect(singleBuffer.getAll()).toEqual([1]);
      singleBuffer.push(2);
      expect(singleBuffer.getAll()).toEqual([2]);
    });

    it("should handle large capacity", () => {
      const largeBuffer = new RingBuffer<number>(10000);
      for (let i = 0; i < 10000; i++) {
        largeBuffer.push(i);
      }
      expect(largeBuffer.size).toBe(10000);
      expect(largeBuffer.getAll()[0]).toBe(0);
      expect(largeBuffer.getAll()[9999]).toBe(9999);
    });

    it("should handle mixed operations", () => {
      buffer.push(1);
      buffer.push(2);
      expect(buffer.getLatest(1)).toEqual([2]);
      buffer.push(3);
      expect(buffer.getAll()).toEqual([1, 2, 3]);
      buffer.push(4);
      expect(buffer.getLatest(2)).toEqual([4, 3]);
      buffer.clear();
      expect(buffer.size).toBe(0);
      buffer.push(5);
      expect(buffer.getAll()).toEqual([5]);
    });

    it("should handle null/undefined values", () => {
      const nullBuffer = new RingBuffer<number | null>(3);
      nullBuffer.push(1);
      nullBuffer.push(null);
      nullBuffer.push(3);
      expect(nullBuffer.getAll()).toEqual([1, null, 3]);
    });
  });

  describe("generic type support", () => {
    it("should work with string type", () => {
      const stringBuffer = new RingBuffer<string>(2);
      stringBuffer.push("hello");
      stringBuffer.push("world");
      expect(stringBuffer.getAll()).toEqual(["hello", "world"]);
    });

    it("should work with boolean type", () => {
      const boolBuffer = new RingBuffer<boolean>(2);
      boolBuffer.push(true);
      boolBuffer.push(false);
      expect(boolBuffer.getAll()).toEqual([true, false]);
    });

    it("should work with complex object type", () => {
      interface LogEntry {
        timestamp: Date;
        level: string;
        message: string;
      }
      const logBuffer = new RingBuffer<LogEntry>(2);
      const entry1: LogEntry = {
        timestamp: new Date("2025-01-31"),
        level: "INFO",
        message: "test",
      };
      const entry2: LogEntry = {
        timestamp: new Date("2025-01-31"),
        level: "ERROR",
        message: "error",
      };
      logBuffer.push(entry1);
      logBuffer.push(entry2);
      const all = logBuffer.getAll();
      expect(all.length).toBe(2);
      expect(all[0].level).toBe("INFO");
      expect(all[1].level).toBe("ERROR");
    });
  });
});
