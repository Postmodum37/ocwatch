import { describe, test, expect } from "bun:test";
import {
  getSessionStatus,
  getStatusFromTimestamp,
  isPendingToolCall,
} from "../utils/sessionStatus";
import type { MessageMeta, PartMeta } from "../../shared/types";

function createMessage(secondsAgo: number): MessageMeta {
  return {
    id: "msg_test",
    sessionID: "ses_test",
    role: "assistant",
    createdAt: new Date(Date.now() - secondsAgo * 1000),
  };
}

describe("getSessionStatus", () => {
  test("returns 'working' for message < 30s ago", () => {
    const messages = [createMessage(10)];
    expect(getSessionStatus(messages)).toBe("working");
  });

  test("returns 'idle' for message 2 min ago", () => {
    const messages = [createMessage(120)];
    expect(getSessionStatus(messages)).toBe("idle");
  });

  test("returns 'completed' for message 10 min ago", () => {
    const messages = [createMessage(600)];
    expect(getSessionStatus(messages)).toBe("completed");
  });

  test("returns 'working' with pending tool call regardless of time", () => {
    const messages = [createMessage(600)];
    expect(getSessionStatus(messages, true)).toBe("working");
  });

  test("returns 'completed' for empty messages array", () => {
    expect(getSessionStatus([])).toBe("completed");
  });

  test("uses most recent message when multiple exist", () => {
    const messages = [createMessage(600), createMessage(10), createMessage(300)];
    expect(getSessionStatus(messages)).toBe("working");
  });

  test("returns 'idle' at exactly 30s boundary (just over)", () => {
    const messages = [createMessage(31)];
    expect(getSessionStatus(messages)).toBe("idle");
  });

  test("returns 'completed' at exactly 5min boundary (just over)", () => {
    const messages = [createMessage(301)];
    expect(getSessionStatus(messages)).toBe("completed");
  });
});

describe("getStatusFromTimestamp", () => {
  test("returns 'working' for timestamp < 30s ago", () => {
    const timestamp = new Date(Date.now() - 10 * 1000);
    expect(getStatusFromTimestamp(timestamp)).toBe("working");
  });

  test("returns 'idle' for timestamp 2 min ago", () => {
    const timestamp = new Date(Date.now() - 120 * 1000);
    expect(getStatusFromTimestamp(timestamp)).toBe("idle");
  });

  test("returns 'completed' for timestamp 10 min ago", () => {
    const timestamp = new Date(Date.now() - 600 * 1000);
    expect(getStatusFromTimestamp(timestamp)).toBe("completed");
  });

  test("returns 'working' with pending tool call regardless of time", () => {
    const timestamp = new Date(Date.now() - 600 * 1000);
    expect(getStatusFromTimestamp(timestamp, true)).toBe("working");
  });
});

describe("isPendingToolCall", () => {
  test("returns true for pending tool call", () => {
    const part: PartMeta = {
      id: "prt_test",
      sessionID: "ses_test",
      messageID: "msg_test",
      type: "tool",
      state: "pending",
    };
    expect(isPendingToolCall(part)).toBe(true);
  });

  test("returns false for completed tool call", () => {
    const part: PartMeta = {
      id: "prt_test",
      sessionID: "ses_test",
      messageID: "msg_test",
      type: "tool",
      state: "completed",
    };
    expect(isPendingToolCall(part)).toBe(false);
  });

  test("returns false for non-tool part", () => {
    const part: PartMeta = {
      id: "prt_test",
      sessionID: "ses_test",
      messageID: "msg_test",
      type: "text",
      state: "pending",
    };
    expect(isPendingToolCall(part)).toBe(false);
  });
});

describe("getSessionStatus - tool completion and waiting logic", () => {
  describe("grace period (5s after tool completion)", () => {
    test("returns 'working' within 5s grace period after tool completion", () => {
      const messages = [createMessage(120)]; // 2 min ago (would be idle)
      const lastToolCompletedAt = new Date(Date.now() - 3000); // 3s ago
      expect(getSessionStatus(messages, false, lastToolCompletedAt)).toBe("working");
    });

    test("returns time-based status after 5s grace period expires", () => {
      const messages = [createMessage(120)]; // 2 min ago (idle)
      const lastToolCompletedAt = new Date(Date.now() - 6000); // 6s ago
      expect(getSessionStatus(messages, false, lastToolCompletedAt)).toBe("idle");
    });

    test("grace period at exactly 5s boundary (should expire)", () => {
      const messages = [createMessage(120)]; // 2 min ago
      const lastToolCompletedAt = new Date(Date.now() - 5000); // exactly 5s
      expect(getSessionStatus(messages, false, lastToolCompletedAt)).toBe("idle");
    });

    test("grace period at 4.9s (still working)", () => {
      const messages = [createMessage(120)]; // 2 min ago
      const lastToolCompletedAt = new Date(Date.now() - 4900); // 4.9s ago
      expect(getSessionStatus(messages, false, lastToolCompletedAt)).toBe("working");
    });
  });

  describe("waiting status (parent with working children)", () => {
    test("returns 'waiting' when workingChildCount > 0", () => {
      const messages = [createMessage(120)]; // 2 min ago
      expect(getSessionStatus(messages, false, undefined, 1)).toBe("waiting");
    });

    test("returns 'waiting' with multiple working children", () => {
      const messages = [createMessage(10)]; // recent message
      expect(getSessionStatus(messages, false, undefined, 3)).toBe("waiting");
    });

    test("returns time-based status when workingChildCount = 0", () => {
      const messages = [createMessage(120)]; // 2 min ago
      expect(getSessionStatus(messages, false, undefined, 0)).toBe("idle");
    });
  });

  describe("status precedence", () => {
    test("pending tool call overrides all (including waiting)", () => {
      const messages = [createMessage(600)]; // old message
      const lastToolCompletedAt = new Date(Date.now() - 10000); // old completion
      expect(getSessionStatus(messages, true, lastToolCompletedAt, 5)).toBe("working");
    });

    test("waiting overrides grace period", () => {
      const messages = [createMessage(120)]; // 2 min ago
      const lastToolCompletedAt = new Date(Date.now() - 3000); // in grace period
      expect(getSessionStatus(messages, false, lastToolCompletedAt, 2)).toBe("waiting");
    });

    test("grace period overrides time-based status", () => {
      const messages = [createMessage(600)]; // 10 min ago (completed)
      const lastToolCompletedAt = new Date(Date.now() - 2000); // 2s ago
      expect(getSessionStatus(messages, false, lastToolCompletedAt, 0)).toBe("working");
    });

    test("time-based status used when no overrides", () => {
      const messages = [createMessage(120)]; // 2 min ago
      const lastToolCompletedAt = new Date(Date.now() - 10000); // old
      expect(getSessionStatus(messages, false, lastToolCompletedAt, 0)).toBe("idle");
    });
  });

  describe("backwards compatibility", () => {
    test("works with only messages parameter (all defaults)", () => {
      const messages = [createMessage(10)];
      expect(getSessionStatus(messages)).toBe("working");
    });

    test("works with hasPendingToolCall only", () => {
      const messages = [createMessage(600)];
      expect(getSessionStatus(messages, true)).toBe("working");
    });

    test("all parameters optional except messages", () => {
      const messages = [createMessage(45)];
      expect(getSessionStatus(messages, false, undefined, undefined)).toBe("idle");
    });
  });

  describe("assistant finished turn (lastAssistantFinished)", () => {
    test("returns 'waiting' when lastAssistantFinished=true and no pending tools", () => {
      const messages = [createMessage(10)]; // recent message (would be working)
      expect(getSessionStatus(messages, false, undefined, undefined, true)).toBe("waiting");
    });

    test("pending tool call overrides finished status", () => {
      const messages = [createMessage(10)];
      expect(getSessionStatus(messages, true, undefined, undefined, true)).toBe("working");
    });

    test("finished status returns waiting even for old messages", () => {
      const messages = [createMessage(120)]; // 2 min ago (would be idle)
      expect(getSessionStatus(messages, false, undefined, undefined, true)).toBe("waiting");
    });

    test("returns time-based when not finished", () => {
      const messages = [createMessage(10)]; // recent (would be working)
      expect(getSessionStatus(messages, false, undefined, undefined, false)).toBe("working");
    });

    test("finished=undefined defaults to time-based status", () => {
      const messages = [createMessage(10)];
      expect(getSessionStatus(messages, false, undefined, undefined, undefined)).toBe("working");
    });

    test("finished overrides grace period", () => {
      const messages = [createMessage(120)];
      const lastToolCompletedAt = new Date(Date.now() - 3000); // in grace period
      expect(getSessionStatus(messages, false, lastToolCompletedAt, 0, true)).toBe("waiting");
    });
  });

  describe("subagent behavior (isSubagent=true)", () => {
    test("subagent returns 'completed' when finished (not 'waiting')", () => {
      const messages = [createMessage(10)]; // recent message
      expect(getSessionStatus(messages, false, undefined, undefined, true, true)).toBe("completed");
    });

    test("subagent still returns 'working' with pending tool call", () => {
      const messages = [createMessage(10)];
      expect(getSessionStatus(messages, true, undefined, undefined, true, true)).toBe("working");
    });

    test("subagent returns 'completed' for finished even with old messages", () => {
      const messages = [createMessage(120)]; // 2 min ago
      expect(getSessionStatus(messages, false, undefined, undefined, true, true)).toBe("completed");
    });

    test("subagent returns 'waiting' when has working children", () => {
      const messages = [createMessage(10)];
      expect(getSessionStatus(messages, false, undefined, 2, true, true)).toBe("waiting");
    });

    test("subagent finished overrides grace period with 'completed'", () => {
      const messages = [createMessage(120)];
      const lastToolCompletedAt = new Date(Date.now() - 3000); // in grace period
      expect(getSessionStatus(messages, false, lastToolCompletedAt, 0, true, true)).toBe("completed");
    });

    test("root agent returns 'waiting' when finished (default isSubagent=false)", () => {
      const messages = [createMessage(10)];
      expect(getSessionStatus(messages, false, undefined, undefined, true, false)).toBe("waiting");
    });

    test("subagent returns time-based status when not finished", () => {
      const messages = [createMessage(10)]; // working
      expect(getSessionStatus(messages, false, undefined, undefined, false, true)).toBe("working");
    });
  });
});
