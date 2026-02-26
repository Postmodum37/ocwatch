import { describe, it, expect } from "bun:test";
import {
  detectAgentPhases,
  getSessionStatusInfo,
  isAssistantFinished,
} from "../server/logic/sessionLogic";
import type { MessageMeta } from "../shared/types";

function createMessage(secondsAgo: number, overrides: Partial<MessageMeta> = {}): MessageMeta {
  return {
    id: `msg_${secondsAgo}_${overrides.role ?? "assistant"}`,
    sessionID: "ses_test",
    role: "assistant",
    createdAt: new Date(Date.now() - secondsAgo * 1000),
    ...overrides,
  };
}

describe("isAssistantFinished", () => {
  it("returns false for empty messages", () => {
    expect(isAssistantFinished([])).toBe(false);
  });

  it("returns true when latest message is assistant with finish=stop", () => {
    const messages: MessageMeta[] = [
      createMessage(20, { role: "assistant", finish: "tool-calls" }),
      createMessage(5, { role: "assistant", finish: "stop" }),
    ];

    expect(isAssistantFinished(messages)).toBe(true);
  });

  it("returns false when latest message is user", () => {
    const messages: MessageMeta[] = [
      createMessage(20, { role: "assistant", finish: "stop" }),
      createMessage(5, { role: "user" }),
    ];

    expect(isAssistantFinished(messages)).toBe(false);
  });

  it("uses most recent message even when array order is mixed", () => {
    const messages: MessageMeta[] = [
      createMessage(10, { role: "assistant", finish: "tool-calls" }),
      createMessage(40, { role: "assistant", finish: "stop" }),
      createMessage(1, { role: "assistant", finish: "stop" }),
    ];
    expect(isAssistantFinished(messages)).toBe(true);
  });
});

describe("detectAgentPhases", () => {
  it("returns 1 phase for single assistant agent", () => {
    const messages: MessageMeta[] = [
      createMessage(30, { agent: "prometheus", tokens: 10 }),
      createMessage(20, { agent: "prometheus", tokens: 20 }),
    ];

    const phases = detectAgentPhases(messages);
    expect(phases).toHaveLength(1);
    expect(phases[0].agent).toBe("prometheus");
    expect(phases[0].messageCount).toBe(2);
    expect(phases[0].tokens).toBe(30);
  });

  it("returns 2 phases for two different agents", () => {
    const messages: MessageMeta[] = [
      createMessage(30, { agent: "prometheus" }),
      createMessage(20, { agent: "atlas" }),
    ];

    const phases = detectAgentPhases(messages);
    expect(phases).toHaveLength(2);
    expect(phases[0].agent).toBe("prometheus");
    expect(phases[1].agent).toBe("atlas");
  });

  it("returns 3 phases when agent switches back", () => {
    const messages: MessageMeta[] = [
      createMessage(30, { agent: "prometheus" }),
      createMessage(20, { agent: "atlas" }),
      createMessage(10, { agent: "prometheus" }),
    ];

    const phases = detectAgentPhases(messages);
    expect(phases).toHaveLength(3);
    expect(phases[0].agent).toBe("prometheus");
    expect(phases[1].agent).toBe("atlas");
    expect(phases[2].agent).toBe("prometheus");
  });

  it("returns empty array for empty messages", () => {
    expect(detectAgentPhases([])).toEqual([]);
  });

  it("returns empty array when there are no assistant messages with agent", () => {
    const messages: MessageMeta[] = [
      createMessage(30, { role: "user", agent: "prometheus" }),
      createMessage(20, { role: "assistant", agent: undefined }),
      createMessage(10, { role: "system", agent: "atlas" }),
    ];

    expect(detectAgentPhases(messages)).toEqual([]);
  });
});

describe("getSessionStatusInfo", () => {
  it("returns working when there is a pending tool call", () => {
    const info = getSessionStatusInfo([createMessage(600)], true);
    expect(info).toEqual({ status: "working" });
  });

  it("returns waiting with children reason when working child sessions exist", () => {
    const info = getSessionStatusInfo([createMessage(600)], false, undefined, 2);
    expect(info.status).toBe("waiting");
    expect(info.waitingReason).toBe("children");
  });

  it("returns waiting-user for finished assistant on root session", () => {
    const info = getSessionStatusInfo([createMessage(10)], false, undefined, 0, true, false);
    expect(info.status).toBe("waiting");
    expect(info.waitingReason).toBe("user");
  });

  it("returns completed for finished assistant on subagent", () => {
    const info = getSessionStatusInfo([createMessage(10)], false, undefined, 0, true, true);
    expect(info).toEqual({ status: "completed" });
  });

  it("returns working during recent tool-completed grace period", () => {
    const lastToolCompletedAt = new Date(Date.now() - 2_000);
    const info = getSessionStatusInfo([createMessage(120)], false, lastToolCompletedAt);
    expect(info).toEqual({ status: "working" });
  });

  it("returns completed for old messages with no overrides", () => {
    const info = getSessionStatusInfo([createMessage(600)]);
    expect(info).toEqual({ status: "completed" });
  });

  it("returns completed for empty message list", () => {
    const info = getSessionStatusInfo([]);
    expect(info).toEqual({ status: "completed" });
  });
});
