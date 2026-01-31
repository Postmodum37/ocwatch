import { describe, it, expect } from "bun:test";
import {
  SessionMetadata,
  MessageMeta,
  PartMeta,
  AgentInfo,
  ToolCall,
  PlanProgress,
  Boulder,
  RingBuffer,
} from "../types";

describe("Type Definitions", () => {
  describe("SessionMetadata", () => {
    it("should create a valid session metadata object", () => {
      const session: SessionMetadata = {
        id: "ses_123",
        projectID: "proj_456",
        directory: "/home/user/project",
        title: "Test Session",
        parentID: "ses_parent",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session.id).toBe("ses_123");
      expect(session.projectID).toBe("proj_456");
      expect(session.parentID).toBe("ses_parent");
    });

    it("should allow optional parentID", () => {
      const session: SessionMetadata = {
        id: "ses_123",
        projectID: "proj_456",
        directory: "/home/user/project",
        title: "Test Session",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session.parentID).toBeUndefined();
    });
  });

  describe("MessageMeta", () => {
    it("should create a valid message metadata object", () => {
      const message: MessageMeta = {
        id: "msg_123",
        sessionID: "ses_456",
        role: "user",
        agent: "claude",
        mode: "normal",
        modelID: "claude-3-sonnet",
        providerID: "anthropic",
        tokens: 1000,
        createdAt: new Date(),
      };

      expect(message.id).toBe("msg_123");
      expect(message.sessionID).toBe("ses_456");
      expect(message.tokens).toBe(1000);
    });
  });

  describe("PartMeta", () => {
    it("should create a valid part metadata object", () => {
      const part: PartMeta = {
        id: "part_123",
        sessionID: "ses_456",
        messageID: "msg_789",
        type: "tool_call",
        tool: "bash",
        state: "complete",
      };

      expect(part.id).toBe("part_123");
      expect(part.tool).toBe("bash");
      expect(part.state).toBe("complete");
    });
  });

  describe("AgentInfo", () => {
    it("should create a valid agent info object", () => {
      const agent: AgentInfo = {
        name: "claude",
        mode: "normal",
        modelID: "claude-3-sonnet",
        active: true,
        sessionID: "ses_123",
      };

      expect(agent.name).toBe("claude");
      expect(agent.active).toBe(true);
    });
  });

  describe("ToolCall", () => {
    it("should create a valid tool call object", () => {
      const toolCall: ToolCall = {
        id: "call_123",
        name: "bash",
        state: "complete",
        timestamp: new Date(),
        sessionID: "ses_456",
        messageID: "msg_789",
      };

      expect(toolCall.id).toBe("call_123");
      expect(toolCall.state).toBe("complete");
    });

    it("should support pending and error states", () => {
      const pending: ToolCall = {
        id: "call_1",
        name: "bash",
        state: "pending",
        timestamp: new Date(),
        sessionID: "ses_1",
        messageID: "msg_1",
      };

      const error: ToolCall = {
        id: "call_2",
        name: "bash",
        state: "error",
        timestamp: new Date(),
        sessionID: "ses_1",
        messageID: "msg_1",
      };

      expect(pending.state).toBe("pending");
      expect(error.state).toBe("error");
    });
  });

  describe("PlanProgress", () => {
    it("should create a valid plan progress object", () => {
      const progress: PlanProgress = {
        completed: 5,
        total: 10,
        progress: 50,
        tasks: ["task1", "task2", "task3"],
      };

      expect(progress.completed).toBe(5);
      expect(progress.total).toBe(10);
      expect(progress.progress).toBe(50);
      expect(progress.tasks.length).toBe(3);
    });
  });

  describe("Boulder", () => {
    it("should create a valid boulder object", () => {
      const boulder: Boulder = {
        activePlan: "plan_123",
        sessionIDs: ["ses_1", "ses_2"],
        status: "active",
        startedAt: new Date(),
        planName: "Test Plan",
      };

      expect(boulder.activePlan).toBe("plan_123");
      expect(boulder.sessionIDs.length).toBe(2);
      expect(boulder.status).toBe("active");
    });
  });
});

describe("RingBuffer", () => {
  describe("constructor", () => {
    it("should create a ring buffer with default capacity", () => {
      const rb = new RingBuffer<number>();
      expect(rb.size).toBe(0);
    });

    it("should create a ring buffer with custom capacity", () => {
      const rb = new RingBuffer<number>(5);
      expect(rb.size).toBe(0);
    });

    it("should enforce minimum capacity of 1", () => {
      const rb = new RingBuffer<number>(0);
      expect(rb.size).toBe(0);
      rb.push(1);
      expect(rb.size).toBe(1);
    });
  });

  describe("push", () => {
    it("should add items to the buffer", () => {
      const rb = new RingBuffer<number>(3);
      rb.push(1);
      rb.push(2);
      rb.push(3);

      expect(rb.size).toBe(3);
    });

    it("should drop oldest item when capacity exceeded", () => {
      const rb = new RingBuffer<number>(3);
      rb.push(1);
      rb.push(2);
      rb.push(3);
      rb.push(4);

      expect(rb.size).toBe(3);
      const all = rb.getAll();
      expect(all).toEqual([2, 3, 4]);
    });

    it("should handle multiple overflow cycles", () => {
      const rb = new RingBuffer<number>(3);
      for (let i = 1; i <= 10; i++) {
        rb.push(i);
      }

      expect(rb.size).toBe(3);
      const all = rb.getAll();
      expect(all).toEqual([8, 9, 10]);
    });
  });

  describe("getAll", () => {
    it("should return all items in order", () => {
      const rb = new RingBuffer<number>(5);
      rb.push(1);
      rb.push(2);
      rb.push(3);

      expect(rb.getAll()).toEqual([1, 2, 3]);
    });

    it("should return items in correct order after overflow", () => {
      const rb = new RingBuffer<number>(3);
      rb.push(1);
      rb.push(2);
      rb.push(3);
      rb.push(4);
      rb.push(5);

      expect(rb.getAll()).toEqual([3, 4, 5]);
    });

    it("should return empty array for empty buffer", () => {
      const rb = new RingBuffer<number>(3);
      expect(rb.getAll()).toEqual([]);
    });
  });

  describe("getLatest", () => {
    it("should return last n items in reverse order", () => {
      const rb = new RingBuffer<number>(10);
      rb.push(1);
      rb.push(2);
      rb.push(3);
      rb.push(4);
      rb.push(5);

      expect(rb.getLatest(2)).toEqual([5, 4]);
    });

    it("should return all items if n exceeds size", () => {
      const rb = new RingBuffer<number>(10);
      rb.push(1);
      rb.push(2);
      rb.push(3);

      expect(rb.getLatest(10)).toEqual([3, 2, 1]);
    });

    it("should return empty array for empty buffer", () => {
      const rb = new RingBuffer<number>(10);
      expect(rb.getLatest(5)).toEqual([]);
    });

    it("should work correctly after overflow", () => {
      const rb = new RingBuffer<number>(3);
      rb.push(1);
      rb.push(2);
      rb.push(3);
      rb.push(4);
      rb.push(5);

      expect(rb.getLatest(2)).toEqual([5, 4]);
    });
  });

  describe("clear", () => {
    it("should clear all items", () => {
      const rb = new RingBuffer<number>(3);
      rb.push(1);
      rb.push(2);
      rb.push(3);

      rb.clear();

      expect(rb.size).toBe(0);
      expect(rb.getAll()).toEqual([]);
    });

    it("should allow adding items after clear", () => {
      const rb = new RingBuffer<number>(3);
      rb.push(1);
      rb.push(2);
      rb.clear();
      rb.push(3);

      expect(rb.size).toBe(1);
      expect(rb.getAll()).toEqual([3]);
    });
  });

  describe("size getter", () => {
    it("should return correct size", () => {
      const rb = new RingBuffer<number>(5);
      expect(rb.size).toBe(0);

      rb.push(1);
      expect(rb.size).toBe(1);

      rb.push(2);
      rb.push(3);
      expect(rb.size).toBe(3);
    });

    it("should not exceed capacity", () => {
      const rb = new RingBuffer<number>(3);
      rb.push(1);
      rb.push(2);
      rb.push(3);
      rb.push(4);
      rb.push(5);

      expect(rb.size).toBe(3);
    });
  });

  describe("generic types", () => {
    it("should work with string type", () => {
      const rb = new RingBuffer<string>(3);
      rb.push("a");
      rb.push("b");
      rb.push("c");

      expect(rb.getAll()).toEqual(["a", "b", "c"]);
    });

    it("should work with object type", () => {
      interface Item {
        id: number;
        name: string;
      }

      const rb = new RingBuffer<Item>(2);
      rb.push({ id: 1, name: "first" });
      rb.push({ id: 2, name: "second" });
      rb.push({ id: 3, name: "third" });

      const all = rb.getAll();
      expect(all.length).toBe(2);
      expect(all[0].id).toBe(2);
      expect(all[1].id).toBe(3);
    });
  });
});
