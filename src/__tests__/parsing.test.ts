import { describe, it, expect } from "bun:test";
import {
  toSessionMetadata,
  toMessageMeta,
  toPartMeta,
  parseJsonData,
  getLatestAssistantMessage,
  getMostRecentPendingPart,
} from "../server/services/parsing";
import type { PartMeta, MessageMeta, SessionMetadata } from "../shared/types";
import type { DbSessionRow, DbMessageRow, DbPartRow } from "../server/storage/queries";

function createSessionRow(overrides: Partial<DbSessionRow> = {}): DbSessionRow {
  return {
    id: "ses_1",
    projectID: "proj_1",
    parentID: "ses_parent",
    slug: null,
    directory: "/tmp/project",
    title: "Session Title",
    version: null,
    timeCreated: 1_700_000_000_000,
    timeUpdated: 1_700_000_005_000,
    ...overrides,
  };
}

function createMessageRow(overrides: Partial<DbMessageRow> = {}): DbMessageRow {
  return {
    id: "msg_1",
    sessionID: "ses_1",
    timeCreated: 1_700_000_000_000,
    timeUpdated: 1_700_000_001_000,
    role: "assistant",
    agent: null,
    data: JSON.stringify({ role: "assistant", time: { created: 1_700_000_000_000 } }),
    ...overrides,
  };
}

function makePartRow(overrides: Partial<DbPartRow> = {}): DbPartRow {
  return {
    id: "prt_1",
    messageID: "msg_1",
    sessionID: "ses_1",
    timeCreated: 1_700_000_000_000,
    timeUpdated: 1_700_000_001_000,
    type: "tool",
    tool: "bash",
    state: "pending",
    data: JSON.stringify({ type: "tool", tool: "bash", state: "pending" }),
    ...overrides,
  };
}

function createMessage(overrides: Partial<MessageMeta> = {}): MessageMeta {
  return {
    id: "msg_meta_1",
    sessionID: "ses_1",
    role: "assistant",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makePart(overrides: Partial<PartMeta> = {}): PartMeta {
  return {
    id: "part_meta_1",
    sessionID: "ses_1",
    messageID: "msg_1",
    type: "tool",
    tool: "bash",
    state: "pending",
    startedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("parseJsonData", () => {
  it("parses valid JSON string", () => {
    const result = parseJsonData<{ role: string }>("{\"role\":\"assistant\"}");
    expect(result).toEqual({ role: "assistant" });
  });

  it("returns object input as-is", () => {
    const result = parseJsonData<{ role: string }>({ role: "user" });
    expect(result).toEqual({ role: "user" });
  });

  it("returns null for null input", () => {
    const result = parseJsonData<{ role: string }>(null);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const result = parseJsonData<{ role: string }>("{invalid-json");
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    const result = parseJsonData<{ role: string }>("");
    expect(result).toBeNull();
  });
});

describe("toSessionMetadata", () => {
  it("converts a normal row", () => {
    const row = createSessionRow();
    const result = toSessionMetadata(row);

    expect(result.id).toBe("ses_1");
    expect(result.projectID).toBe("proj_1");
    expect(result.directory).toBe("/tmp/project");
    expect(result.title).toBe("Session Title");
    expect(result.parentID).toBe("ses_parent");
    expect(result.createdAt).toEqual(new Date(1_700_000_000_000));
    expect(result.updatedAt).toEqual(new Date(1_700_000_005_000));
  });

  it("maps null parentID to undefined", () => {
    const row = createSessionRow({ parentID: null });
    const result = toSessionMetadata(row);
    expect(result.parentID).toBeUndefined();
  });
});

describe("toMessageMeta", () => {
  it("converts a normal row", () => {
    const row = createMessageRow({
      data: JSON.stringify({
        role: "assistant",
        agent: "prometheus",
        mode: "build",
        modelID: "gpt-5",
        providerID: "openai",
        parentID: "msg_parent",
        finish: "stop",
        cost: 0.42,
        time: { created: 1_700_000_100_000 },
      }),
    });

    const result = toMessageMeta(row);

    expect(result.role).toBe("assistant");
    expect(result.agent).toBe("prometheus");
    expect(result.mode).toBe("build");
    expect(result.modelID).toBe("gpt-5");
    expect(result.providerID).toBe("openai");
    expect(result.parentID).toBe("msg_parent");
    expect(result.finish).toBe("stop");
    expect(result.cost).toBe(0.42);
    expect(result.createdAt).toEqual(new Date(1_700_000_100_000));
  });

  it("reads nested model fields", () => {
    const row = createMessageRow({
      data: JSON.stringify({
        role: "assistant",
        model: { modelID: "claude-3", providerID: "anthropic" },
      }),
    });

    const result = toMessageMeta(row);
    expect(result.modelID).toBe("claude-3");
    expect(result.providerID).toBe("anthropic");
  });

  it("sums input and output tokens", () => {
    const row = createMessageRow({
      data: JSON.stringify({ role: "assistant", tokens: { input: 12, output: 8 } }),
    });

    const result = toMessageMeta(row);
    expect(result.tokens).toBe(20);
  });

  it("omits tokens when token fields are missing", () => {
    const row = createMessageRow({
      data: JSON.stringify({ role: "assistant" }),
    });

    const result = toMessageMeta(row);
    expect(result.tokens).toBeUndefined();
  });

  it("falls back to row values when data is corrupt", () => {
    const row = createMessageRow({
      role: "user",
      timeCreated: 1_700_000_222_000,
      data: "not-json",
    });

    const result = toMessageMeta(row);
    expect(result.role).toBe("user");
    expect(result.createdAt).toEqual(new Date(1_700_000_222_000));
    expect(result.modelID).toBeUndefined();
  });
});

describe("toPartMeta", () => {
  it("converts a normal tool part", () => {
    const row = makePartRow({
      data: JSON.stringify({
        type: "tool",
        tool: "bash",
        state: "pending",
        callID: "call_1",
        input: { command: "ls -la" },
      }),
    });

    const result = toPartMeta(row);
    expect(result.type).toBe("tool");
    expect(result.tool).toBe("bash");
    expect(result.state).toBe("pending");
    expect(result.callID).toBe("call_1");
    expect(result.input).toEqual({ command: "ls -la" });
  });

  it("reads nested state object fields", () => {
    const row = makePartRow({
      state: null,
      data: JSON.stringify({
        type: "tool",
        tool: "read",
        state: {
          status: "running",
          title: "Reading file",
          input: { filePath: "/tmp/a.ts" },
        },
      }),
    });

    const result = toPartMeta(row);
    expect(result.state).toBe("running");
    expect(result.title).toBe("Reading file");
    expect(result.input).toEqual({ filePath: "/tmp/a.ts" });
  });

  it("extracts and truncates error state output", () => {
    const longError = "x".repeat(600);
    const row = makePartRow({
      data: JSON.stringify({
        type: "tool",
        tool: "bash",
        state: {
          status: "error",
          output: longError,
        },
      }),
    });

    const result = toPartMeta(row);
    expect(result.state).toBe("error");
    expect(result.error).toHaveLength(500);
  });

  it("maps time start/end into startedAt/completedAt", () => {
    const row = makePartRow({
      data: JSON.stringify({
        type: "tool",
        tool: "grep",
        time: { start: 1_700_000_010_000, end: 1_700_000_020_000 },
      }),
    });

    const result = toPartMeta(row);
    expect(result.startedAt).toEqual(new Date(1_700_000_010_000));
    expect(result.completedAt).toEqual(new Date(1_700_000_020_000));
  });

  it("maps reasoning text only for reasoning type", () => {
    const row = makePartRow({
      type: "reasoning",
      data: JSON.stringify({ type: "reasoning", text: "Think step-by-step" }),
    });

    const result = toPartMeta(row);
    expect(result.reasoningText).toBe("Think step-by-step");
  });

  it("maps patch files list", () => {
    const row = makePartRow({
      type: "patch",
      data: JSON.stringify({ type: "patch", files: ["src/a.ts", 42, "src/b.ts"] }),
    });

    const result = toPartMeta(row);
    expect(result.patchFiles).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("getLatestAssistantMessage", () => {
  it("returns most recent assistant message", () => {
    const messages: MessageMeta[] = [
      createMessage({ id: "m1", role: "assistant", createdAt: new Date("2025-01-01T00:00:00Z") }),
      createMessage({ id: "m2", role: "user", createdAt: new Date("2025-01-01T00:01:00Z") }),
      createMessage({ id: "m3", role: "assistant", createdAt: new Date("2025-01-01T00:02:00Z") }),
    ];

    const result = getLatestAssistantMessage(messages);
    expect(result?.id).toBe("m3");
  });

  it("returns undefined for empty message list", () => {
    const result = getLatestAssistantMessage([]);
    expect(result).toBeUndefined();
  });

  it("returns undefined when no assistant messages exist", () => {
    const messages: MessageMeta[] = [
      createMessage({ id: "m1", role: "user" }),
      createMessage({ id: "m2", role: "system" }),
    ];

    const result = getLatestAssistantMessage(messages);
    expect(result).toBeUndefined();
  });
});

describe("getMostRecentPendingPart", () => {
  it("returns most recent pending part", () => {
    const parts: PartMeta[] = [
      makePart({ id: "p1", state: "pending", startedAt: new Date("2025-01-01T00:00:00Z") }),
      makePart({ id: "p2", state: "running", startedAt: new Date("2025-01-01T00:01:00Z") }),
      makePart({ id: "p3", state: "completed", startedAt: new Date("2025-01-01T00:02:00Z") }),
    ];

    const result = getMostRecentPendingPart(parts);
    expect(result?.id).toBe("p2");
  });

  it("returns undefined when there are no pending parts", () => {
    const parts: PartMeta[] = [
      makePart({ id: "p1", state: "completed" }),
      makePart({ id: "p2", state: "error" }),
    ];

    const result = getMostRecentPendingPart(parts);
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty part list", () => {
    const result = getMostRecentPendingPart([]);
    expect(result).toBeUndefined();
  });
});

describe("type checks", () => {
  it("ensures mapped values satisfy shared types", () => {
    const session: SessionMetadata = toSessionMetadata(createSessionRow());
    const message: MessageMeta = toMessageMeta(createMessageRow());
    const part: PartMeta = toPartMeta(makePartRow());

    expect(session.id).toBe("ses_1");
    expect(message.id).toBe("msg_1");
    expect(part.id).toBe("prt_1");
  });
});
