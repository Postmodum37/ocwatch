import { describe, test, expect } from "bun:test";
import { formatCurrentAction, deriveActivityType, generateActivityMessage } from "../storage/partParser";
import type { PartMeta } from "../../shared/types";

function createPart(overrides: Partial<PartMeta> = {}): PartMeta {
  return {
    id: "prt_test",
    sessionID: "ses_test",
    messageID: "msg_test",
    type: "tool",
    tool: "mcp_read",
    state: "pending",
    ...overrides,
  };
}

describe("formatCurrentAction", () => {
  test("returns 'Reading /short/path.ts' for filePath input", () => {
    const part = createPart({
      tool: "mcp_read",
      input: { filePath: "/short/path.ts" },
    });
    expect(formatCurrentAction(part)).toBe("Reading /short/path.ts");
  });

  test("truncates long paths to 40 chars with ellipsis prefix", () => {
    const longPath = "/Users/tomas/Workspace/very/deeply/nested/project/src/components/MyComponent.tsx";
    const part = createPart({
      tool: "mcp_read",
      input: { filePath: longPath },
    });
    const result = formatCurrentAction(part);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(50);
    expect(result).toContain("...");
  });

  test("returns 'Running bun test' for command input", () => {
    const part = createPart({
      tool: "mcp_bash",
      input: { command: "bun test" },
    });
    expect(formatCurrentAction(part)).toBe("Running bun test");
  });

  test("truncates long commands", () => {
    const longCommand = "bun run build && bun run test && bun run lint && bun run deploy";
    const part = createPart({
      tool: "mcp_bash",
      input: { command: longCommand },
    });
    const result = formatCurrentAction(part);
    expect(result).not.toBeNull();
    expect(result).toContain("...");
  });

  test("returns 'Searching for pattern' for pattern input", () => {
    const part = createPart({
      tool: "mcp_grep",
      input: { pattern: "TODO" },
    });
    expect(formatCurrentAction(part)).toBe('Searching for "TODO"');
  });

  test("returns tool name only when no input", () => {
    const part = createPart({
      tool: "mcp_read",
      input: undefined,
    });
    expect(formatCurrentAction(part)).toBe("Reading");
  });

  test("returns null when no tool", () => {
    const part = createPart({
      tool: undefined,
    });
    expect(formatCurrentAction(part)).toBeNull();
  });

  test("uses title as fallback when no input params match", () => {
    const part = createPart({
      tool: "mcp_edit",
      input: {},
      title: "Editing file.ts",
    });
    expect(formatCurrentAction(part)).toBe("Editing file.ts");
  });

  test("prioritizes filePath over other input params", () => {
    const part = createPart({
      tool: "mcp_edit",
      input: {
        filePath: "/src/index.ts",
        command: "some command",
        pattern: "some pattern",
      },
    });
    expect(formatCurrentAction(part)).toBe("Editing /src/index.ts");
  });

  test("handles url input for webfetch", () => {
    const part = createPart({
      tool: "mcp_webfetch",
      input: { url: "https://example.com/api" },
    });
    expect(formatCurrentAction(part)).toBe("Fetching https://example.com/api");
  });

  test("handles query input", () => {
    const part = createPart({
      tool: "mcp_search",
      input: { query: "react hooks" },
    });
    expect(formatCurrentAction(part)).toBe('mcp_search "react hooks"');
  });

  test("normalizes tool names (removes mcp_ prefix)", () => {
    const part = createPart({
      tool: "mcp_write",
      input: { filePath: "/test.ts" },
    });
    expect(formatCurrentAction(part)).toBe("Writing /test.ts");
  });
});

describe("waiting-user derivation", () => {
  const idleActivityState = {
    hasPendingToolCall: false,
    pendingCount: 0,
    completedCount: 0,
    lastToolCompletedAt: null,
    isReasoning: false,
    reasoningPreview: null,
    patchFilesCount: 0,
    stepFinishReason: null,
    activeToolNames: [],
  };

  test("uses waitingReason=user for waiting-user activity", () => {
    const activityType = deriveActivityType(idleActivityState, false, false, "waiting", "user");
    const message = generateActivityMessage(idleActivityState, false, false, "waiting", undefined, "user");

    expect(activityType).toBe("waiting-user");
    expect(message).toBe("Waiting for user input");
  });

  test("does not use waiting-user for waitingReason=children", () => {
    const activityType = deriveActivityType(idleActivityState, true, false, "waiting", "children");
    const message = generateActivityMessage(idleActivityState, true, false, "waiting", undefined, "children");

    expect(activityType).toBe("idle");
    expect(message).toBeNull();
  });
});
