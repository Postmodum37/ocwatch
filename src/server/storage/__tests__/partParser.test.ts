import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  parsePart,
  getPartsForSession,
  getSessionToolState,
  isPendingToolCall,
  getToolCallsForSession,
  formatCurrentAction,
} from "../partParser";

const TEST_DIR = "/tmp/ocwatch-partparser-test";
const STORAGE_DIR = join(TEST_DIR, "opencode", "storage");
const SESSION_ID = "ses_test123";
const MESSAGE_ID_1 = "msg_test001";
const MESSAGE_ID_2 = "msg_test002";
const MESSAGE_ID_3 = "msg_test003";
const PART_ID_1 = "prt_test001";
const PART_ID_2 = "prt_test002";
const PART_ID_3 = "prt_test003";

beforeAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(join(STORAGE_DIR, "message", SESSION_ID), { recursive: true });
  await mkdir(join(STORAGE_DIR, "part", MESSAGE_ID_1), { recursive: true });
  await mkdir(join(STORAGE_DIR, "part", MESSAGE_ID_2), { recursive: true });
  await mkdir(join(STORAGE_DIR, "part", MESSAGE_ID_3), { recursive: true });
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("isPendingToolCall", () => {
  test("returns true for pending tool call (string state)", () => {
    const part = {
      id: PART_ID_1,
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "mcp_read",
      state: "pending",
    };

    expect(isPendingToolCall(part)).toBe(true);
  });

  test("returns false for completed tool call (string state)", () => {
    const part = {
      id: PART_ID_1,
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "mcp_read",
      state: "completed",
    };

    expect(isPendingToolCall(part)).toBe(false);
  });

  test("returns true for pending tool call (object state)", () => {
    const part = {
      id: PART_ID_1,
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "mcp_bash",
      state: "pending",
      input: { command: "ls -la" },
    };

    expect(isPendingToolCall(part)).toBe(true);
  });

  test("returns false for completed tool call (object state)", () => {
    const part = {
      id: PART_ID_1,
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "mcp_bash",
      state: "completed",
      input: { command: "ls -la" },
    };

    expect(isPendingToolCall(part)).toBe(false);
  });

  test("returns false for non-tool part", () => {
    const part = {
      id: PART_ID_1,
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "text",
    };

    expect(isPendingToolCall(part)).toBe(false);
  });

  test("returns false when state is undefined", () => {
    const part = {
      id: PART_ID_1,
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "mcp_read",
    };

    expect(isPendingToolCall(part)).toBe(false);
  });
});

describe("getPartsForSession", () => {
  beforeAll(async () => {
    // Create messages
    const messages = [
      {
        id: MESSAGE_ID_1,
        sessionID: SESSION_ID,
        role: "assistant",
        time: { created: 1700000000000, completed: 1700000001000 },
      },
      {
        id: MESSAGE_ID_2,
        sessionID: SESSION_ID,
        role: "assistant",
        time: { created: 1700000002000, completed: 1700000003000 },
      },
      {
        id: MESSAGE_ID_3,
        sessionID: SESSION_ID,
        role: "user",
        time: { created: 1700000004000 },
      },
    ];

    for (const msg of messages) {
      await writeFile(
        join(STORAGE_DIR, "message", SESSION_ID, `${msg.id}.json`),
        JSON.stringify(msg)
      );
    }

    // Create parts for MESSAGE_ID_1
    const part1 = {
      id: PART_ID_1,
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "mcp_read",
      state: {
        status: "completed",
        input: { filePath: "/test/file.ts" },
        output: "File content",
        title: "test/file.ts",
      },
      time: { start: 1700000000500, end: 1700000000800 },
    };

    const part2 = {
      id: PART_ID_2,
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "mcp_bash",
      state: {
        status: "completed",
        input: { command: "ls -la" },
        output: "directory listing",
      },
      time: { start: 1700000000900, end: 1700000001000 },
    };

    await writeFile(
      join(STORAGE_DIR, "part", MESSAGE_ID_1, `${PART_ID_1}.json`),
      JSON.stringify(part1)
    );

    await writeFile(
      join(STORAGE_DIR, "part", MESSAGE_ID_1, `${PART_ID_2}.json`),
      JSON.stringify(part2)
    );

    // Create parts for MESSAGE_ID_2 (one pending)
    const part3 = {
      id: PART_ID_3,
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_2,
      type: "tool",
      tool: "mcp_edit",
      state: {
        status: "pending",
        input: { filePath: "/test/edit.ts" },
      },
      time: { start: 1700000002500 },
    };

    await writeFile(
      join(STORAGE_DIR, "part", MESSAGE_ID_2, `${PART_ID_3}.json`),
      JSON.stringify(part3)
    );

    // MESSAGE_ID_3 has no parts (user message)
  });

  test("returns all parts for a session", async () => {
    const parts = await getPartsForSession(SESSION_ID, TEST_DIR);

    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.id).sort()).toEqual([PART_ID_1, PART_ID_2, PART_ID_3].sort());
  });

  test("does not scan part/ directory", async () => {
    // Create a part file NOT in any message directory (should be ignored)
    const orphanPartDir = join(STORAGE_DIR, "part", "msg_orphan");
    await mkdir(orphanPartDir, { recursive: true });
    await writeFile(
      join(orphanPartDir, "prt_orphan.json"),
      JSON.stringify({
        id: "prt_orphan",
        sessionID: "ses_other",
        messageID: "msg_orphan",
        type: "tool",
        tool: "mcp_write",
        state: "completed",
      })
    );

    const parts = await getPartsForSession(SESSION_ID, TEST_DIR);

    // Should only return parts from messages in this session
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => p.sessionID === SESSION_ID)).toBe(true);
  });

  test("handles messages with no parts gracefully", async () => {
    const parts = await getPartsForSession(SESSION_ID, TEST_DIR);

    // MESSAGE_ID_3 has no parts, should not error
    expect(parts).toHaveLength(3);
  });

  test("returns empty array for session with no messages", async () => {
    const parts = await getPartsForSession("ses_nonexistent", TEST_DIR);
    expect(parts).toEqual([]);
  });

  test("preserves full tool input payload", async () => {
    const FULL_INPUT_SESSION_ID = "ses_fullinput";
    const FULL_INPUT_MESSAGE_ID = "msg_fullinput";
    const fullInputDir = join(STORAGE_DIR, "part", FULL_INPUT_MESSAGE_ID);
    await mkdir(fullInputDir, { recursive: true });

    const rawPartPath = join(fullInputDir, "prt_full_input.json");
    await writeFile(
      rawPartPath,
      JSON.stringify({
        id: "prt_full_input",
        sessionID: FULL_INPUT_SESSION_ID,
        messageID: FULL_INPUT_MESSAGE_ID,
        type: "tool",
        tool: "task",
        state: {
          status: "completed",
          input: {
            description: "Investigate issue",
            subagent_type: "explore",
            todos: [{ content: "One" }],
          },
        },
      })
    );

    const parsed = await parsePart(rawPartPath);

    expect(parsed?.input?.description).toBe("Investigate issue");
    expect(parsed?.input?.subagent_type).toBe("explore");
    expect(Array.isArray(parsed?.input?.todos)).toBe(true);
  });
});

describe("getSessionToolState", () => {
  test("detects pending tool calls", async () => {
    const parts = await getPartsForSession(SESSION_ID, TEST_DIR);
    const state = getSessionToolState(parts);

    expect(state.hasPendingToolCall).toBe(true);
    expect(state.pendingCount).toBe(1);
  });

  test("calculates lastToolCompletedAt from most recent completed tool", async () => {
    const parts = await getPartsForSession(SESSION_ID, TEST_DIR);
    const state = getSessionToolState(parts);

    expect(state.lastToolCompletedAt).toBeInstanceOf(Date);
    // Part 2 has end time 1700000001000
    expect(state.lastToolCompletedAt?.getTime()).toBe(1700000001000);
  });

  test("handles session with no tool calls", () => {
    const state = getSessionToolState([]);

    expect(state.hasPendingToolCall).toBe(false);
    expect(state.pendingCount).toBe(0);
    expect(state.completedCount).toBe(0);
    expect(state.lastToolCompletedAt).toBeNull();
  });

  test("counts completed and pending tool calls correctly", async () => {
    const parts = await getPartsForSession(SESSION_ID, TEST_DIR);
    const state = getSessionToolState(parts);

    expect(state.completedCount).toBe(2); // PART_ID_1 and PART_ID_2
    expect(state.pendingCount).toBe(1); // PART_ID_3
  });

  test("returns null for lastToolCompletedAt when no completed tools", () => {
    const parts = [
      {
        id: "prt_pending",
        sessionID: SESSION_ID,
        messageID: MESSAGE_ID_1,
        type: "tool",
        tool: "mcp_bash",
        state: "pending",
      },
    ];

    const state = getSessionToolState(parts);

    expect(state.hasPendingToolCall).toBe(true);
    expect(state.lastToolCompletedAt).toBeNull();
  });
});

describe("getToolCallsForSession", () => {
  beforeAll(async () => {
    // Ensure we have the messages and parts created from previous tests
    // The existing setup already has:
    // - MESSAGE_ID_1 with PART_ID_1 (mcp_read, completed) and PART_ID_2 (mcp_bash, completed)
    // - MESSAGE_ID_2 with PART_ID_3 (mcp_edit, pending)
    // - MESSAGE_ID_3 with no parts
  });

  test("returns array of ToolCallSummary", async () => {
    const messageAgent = new Map([
      [MESSAGE_ID_1, "sisyphus"],
      [MESSAGE_ID_2, "explore"],
      [MESSAGE_ID_3, "sisyphus"],
    ]);

    const result = await getToolCallsForSession(SESSION_ID, messageAgent, TEST_DIR);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Check structure of first item
    const firstCall = result[0];
    expect(firstCall).toHaveProperty("id");
    expect(firstCall).toHaveProperty("name");
    expect(firstCall).toHaveProperty("state");
    expect(firstCall).toHaveProperty("summary");
    expect(firstCall).toHaveProperty("input");
    expect(firstCall).toHaveProperty("timestamp");
    expect(firstCall).toHaveProperty("agentName");
  });

  test("filters to only tool type parts", async () => {
    const messageAgent = new Map([
      [MESSAGE_ID_1, "sisyphus"],
      [MESSAGE_ID_2, "explore"],
    ]);

    const result = await getToolCallsForSession(SESSION_ID, messageAgent, TEST_DIR);

    // Should have 3 tool parts (PART_ID_1, PART_ID_2, PART_ID_3)
    expect(result.length).toBe(3);
    expect(result.every((call) => call.name.length > 0)).toBe(true);
  });

  test("includes agent name from messageAgent map", async () => {
    const messageAgent = new Map([
      [MESSAGE_ID_1, "sisyphus"],
      [MESSAGE_ID_2, "explore"],
    ]);

    const result = await getToolCallsForSession(SESSION_ID, messageAgent, TEST_DIR);

    const sisyphusCall = result.find((call) => call.agentName === "sisyphus");
    const exploreCall = result.find((call) => call.agentName === "explore");

    expect(sisyphusCall).toBeDefined();
    expect(exploreCall).toBeDefined();
  });

  test("sorts by timestamp descending (newest first)", async () => {
    const messageAgent = new Map([
      [MESSAGE_ID_1, "sisyphus"],
      [MESSAGE_ID_2, "explore"],
    ]);

    const result = await getToolCallsForSession(SESSION_ID, messageAgent, TEST_DIR);

    // Check timestamps are in descending order
    for (let i = 0; i < result.length - 1; i++) {
      const current = new Date(result[i].timestamp).getTime();
      const next = new Date(result[i + 1].timestamp).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }

    // The pending tool (MESSAGE_ID_2, start: 1700000002500) should be first
    expect(result[0].state).toBe("pending");
    expect(result[0].agentName).toBe("explore");
  });

  test("respects 50 item limit", async () => {
    // Create a session with many tool calls
    const MANY_SESSION_ID = "ses_many";
    const MANY_MESSAGE_ID = "msg_many";

    await mkdir(join(STORAGE_DIR, "message", MANY_SESSION_ID), { recursive: true });
    await mkdir(join(STORAGE_DIR, "part", MANY_MESSAGE_ID), { recursive: true });

    const messageData = {
      id: MANY_MESSAGE_ID,
      sessionID: MANY_SESSION_ID,
      role: "assistant",
      agent: "bulk-agent",
      time: { created: 1700000000000 },
    };
    await writeFile(
      join(STORAGE_DIR, "message", MANY_SESSION_ID, `${MANY_MESSAGE_ID}.json`),
      JSON.stringify(messageData)
    );

    // Create 60 tool call parts
    for (let i = 0; i < 60; i++) {
      const toolPart = {
        id: `prt_bulk_${i}`,
        sessionID: MANY_SESSION_ID,
        messageID: MANY_MESSAGE_ID,
        type: "tool",
        tool: "mcp_read",
        state: {
          status: "completed",
          input: {
            filePath: `/test/file_${i}.ts`,
          },
        },
        time: { start: 1700000000000 + i * 100, end: 1700000000000 + i * 100 + 50 },
      };
      await writeFile(
        join(STORAGE_DIR, "part", MANY_MESSAGE_ID, `prt_bulk_${i}.json`),
        JSON.stringify(toolPart)
      );
    }

    const messageAgent = new Map([[MANY_MESSAGE_ID, "bulk-agent"]]);

    const result = await getToolCallsForSession(MANY_SESSION_ID, messageAgent, TEST_DIR);

    expect(result.length).toBe(50);
  });

  test("generates summary from tool input", async () => {
    const messageAgent = new Map([
      [MESSAGE_ID_1, "sisyphus"],
      [MESSAGE_ID_2, "explore"],
    ]);

    const result = await getToolCallsForSession(SESSION_ID, messageAgent, TEST_DIR);

    const readCall = result.find((call) => call.name === "mcp_read");
    const bashCall = result.find((call) => call.name === "mcp_bash");

    expect(readCall?.summary).toContain("file.ts");
    expect(bashCall?.summary).toContain("ls -la");
  });

  test("maps state correctly", async () => {
    const messageAgent = new Map([
      [MESSAGE_ID_1, "sisyphus"],
      [MESSAGE_ID_2, "explore"],
    ]);

    const result = await getToolCallsForSession(SESSION_ID, messageAgent, TEST_DIR);

    const completedCall = result.find((call) => call.name === "mcp_read");
    const pendingCall = result.find((call) => call.name === "mcp_edit");

    expect(completedCall?.state).toBe("complete");
    expect(pendingCall?.state).toBe("pending");
  });

   test("returns empty array for session with no parts", async () => {
     const EMPTY_SESSION_ID = "ses_empty";
     await mkdir(join(STORAGE_DIR, "message", EMPTY_SESSION_ID), { recursive: true });

     const messageData = {
       id: "msg_empty",
       sessionID: EMPTY_SESSION_ID,
       role: "assistant",
       agent: "empty-agent",
       time: { created: 1700000000000 },
     };
     await writeFile(
       join(STORAGE_DIR, "message", EMPTY_SESSION_ID, "msg_empty.json"),
       JSON.stringify(messageData)
     );

     const messageAgent = new Map([["msg_empty", "empty-agent"]]);
     const result = await getToolCallsForSession(EMPTY_SESSION_ID, messageAgent, TEST_DIR);

     expect(result).toEqual([]);
   });
});

describe("formatCurrentAction", () => {
  test("returns null when part has no tool", () => {
    const part = {
      id: "prt_test",
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "text",
    };

    expect(formatCurrentAction(part)).toBeNull();
  });

  test("handles delegate_task with description and subagent_type", () => {
    const part = {
      id: "prt_test",
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "task",
      input: {
        description: "Explore codebase",
        subagent_type: "explore",
      },
    };

    expect(formatCurrentAction(part)).toBe("Explore codebase (explore)");
  });

  test("handles delegate_task with only subagent_type", () => {
    const part = {
      id: "prt_test",
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "task",
      input: {
        subagent_type: "librarian",
      },
    };

    expect(formatCurrentAction(part)).toBe("Delegating (librarian)");
  });

  test("handles delegate_task with neither description nor subagent_type", () => {
    const part = {
      id: "prt_test",
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "task",
      input: {},
    };

    expect(formatCurrentAction(part)).toBe("Delegating task");
  });

  test("handles delegate_task tool name (not just task)", () => {
    const part = {
      id: "prt_test",
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "delegate_task",
      input: {
        description: "Run tests",
        subagent_type: "explore",
      },
    };

    expect(formatCurrentAction(part)).toBe("Run tests (explore)");
  });

  test("falls back to title when delegate_task has no description", () => {
    const part = {
      id: "prt_test",
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "task",
      input: {
        subagent_type: "explore",
      },
      title: "Custom Title",
    };

    expect(formatCurrentAction(part)).toBe("Delegating (explore)");
  });

  test("returns tool display name for non-delegate_task tools", () => {
    const part = {
      id: "prt_test",
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID_1,
      type: "tool",
      tool: "mcp_read",
      input: {
        filePath: "/test/file.ts",
      },
    };

    expect(formatCurrentAction(part)).toContain("Reading");
  });

   test("handles delegate_task with empty input object", () => {
     const part = {
       id: "prt_test",
       sessionID: SESSION_ID,
       messageID: MESSAGE_ID_1,
       type: "tool",
       tool: "task",
     };

     expect(formatCurrentAction(part)).toBe("Delegating task");
   });

   test("handles todowrite with multiple todos", () => {
     const part = {
       id: "prt_test",
       sessionID: SESSION_ID,
       messageID: MESSAGE_ID_1,
       type: "tool",
       tool: "todowrite",
       input: {
         todos: [
           { id: "1", content: "Setup", status: "pending", priority: "high" },
           { id: "2", content: "Build", status: "pending", priority: "high" },
           { id: "3", content: "Test", status: "pending", priority: "high" },
         ],
       },
     };

     expect(formatCurrentAction(part)).toBe("Updated 3 todos: Setup, Build...");
   });

   test("handles todowrite with empty todos array", () => {
     const part = {
       id: "prt_test",
       sessionID: SESSION_ID,
       messageID: MESSAGE_ID_1,
       type: "tool",
       tool: "todowrite",
       input: {
         todos: [],
       },
     };

     expect(formatCurrentAction(part)).toBe("Cleared todos");
   });

   test("handles todowrite with single todo", () => {
     const part = {
       id: "prt_test",
       sessionID: SESSION_ID,
       messageID: MESSAGE_ID_1,
       type: "tool",
       tool: "todowrite",
       input: {
         todos: [
           { id: "1", content: "Single task", status: "pending", priority: "high" },
         ],
       },
     };

     expect(formatCurrentAction(part)).toBe("Updated 1 todo: Single task");
   });

   test("handles todowrite with long content truncated at 30 chars", () => {
     const part = {
       id: "prt_test",
       sessionID: SESSION_ID,
       messageID: MESSAGE_ID_1,
       type: "tool",
       tool: "todowrite",
       input: {
         todos: [
           { id: "1", content: "A very long todo item that exceeds thirty chars", status: "pending", priority: "high" },
         ],
       },
     };

     expect(formatCurrentAction(part)).toBe("Updated 1 todo: A very long todo item that exc");
   });

   test("handles todowrite with two todos no ellipsis", () => {
     const part = {
       id: "prt_test",
       sessionID: SESSION_ID,
       messageID: MESSAGE_ID_1,
       type: "tool",
       tool: "todowrite",
       input: {
         todos: [
           { id: "1", content: "First", status: "pending", priority: "high" },
           { id: "2", content: "Second", status: "pending", priority: "high" },
         ],
       },
     };

     expect(formatCurrentAction(part)).toBe("Updated 2 todos: First, Second");
   });

   test("handles todowrite with no input", () => {
     const part = {
       id: "prt_test",
       sessionID: SESSION_ID,
       messageID: MESSAGE_ID_1,
       type: "tool",
       tool: "todowrite",
     };

     expect(formatCurrentAction(part)).toBe("Cleared todos");
   });

   test("handles todoread", () => {
     const part = {
       id: "prt_test",
       sessionID: SESSION_ID,
       messageID: MESSAGE_ID_1,
       type: "tool",
       tool: "todoread",
       input: {},
     };

     expect(formatCurrentAction(part)).toBe("Reading todos");
   });

   test("handles todoread with no input", () => {
     const part = {
       id: "prt_test",
       sessionID: SESSION_ID,
       messageID: MESSAGE_ID_1,
       type: "tool",
       tool: "todoread",
     };

     expect(formatCurrentAction(part)).toBe("Reading todos");
   });
});
