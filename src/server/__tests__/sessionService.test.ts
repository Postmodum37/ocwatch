import { describe, test, expect } from "bun:test";
import { isAssistantFinished } from "../services/sessionService";
import type { MessageMeta } from "../../shared/types";

function createMessage(
  role: "assistant" | "user",
  createdAtMs: number,
  finish?: string
): MessageMeta {
  return {
    id: `${role}-${createdAtMs}`,
    sessionID: "ses_test",
    role,
    createdAt: new Date(createdAtMs),
    finish,
  };
}

describe("isAssistantFinished", () => {
  test("returns true when latest message is assistant stop", () => {
    const messages = [
      createMessage("user", 1000),
      createMessage("assistant", 2000, "stop"),
    ];

    expect(isAssistantFinished(messages)).toBe(true);
  });

  test("returns false when a newer user message exists", () => {
    const messages = [
      createMessage("assistant", 2000, "stop"),
      createMessage("user", 3000),
    ];

    expect(isAssistantFinished(messages)).toBe(false);
  });

  test("returns false when latest assistant did not stop", () => {
    const messages = [createMessage("assistant", 2000, "tool-calls")];
    expect(isAssistantFinished(messages)).toBe(false);
  });
});
