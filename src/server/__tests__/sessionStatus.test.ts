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
