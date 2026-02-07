import { describe, expect, it } from "bun:test";
import { groupIntoBursts } from "../burstGrouping";
import type {
  ActivityItem,
  AgentCompleteActivity,
  AgentSpawnActivity,
  ToolCallActivity,
} from "../../types";

function ts(seconds: number): Date {
  return new Date(2025, 0, 1, 0, 0, seconds);
}

function toolCall(
  id: string,
  seconds: number,
  agentName: string,
  toolName = "read",
  state: ToolCallActivity["state"] = "complete"
): ToolCallActivity {
  return {
    id,
    type: "tool-call",
    timestamp: ts(seconds),
    agentName,
    toolName,
    state,
    summary: `${toolName} summary`,
    input: {},
  };
}

function agentSpawn(
  id: string,
  seconds: number,
  agentName: string,
  spawnedAgentName: string
): AgentSpawnActivity {
  return {
    id,
    type: "agent-spawn",
    timestamp: ts(seconds),
    agentName,
    spawnedAgentName,
  };
}

function agentComplete(
  id: string,
  seconds: number,
  agentName: string
): AgentCompleteActivity {
  return {
    id,
    type: "agent-complete",
    timestamp: ts(seconds),
    agentName,
    status: "completed",
    durationMs: 1000,
  };
}

describe("groupIntoBursts", () => {
  it("returns empty output for empty input", () => {
    expect(groupIntoBursts([])).toEqual([]);
  });

  it("groups a single tool call into one burst", () => {
    const items: ActivityItem[] = [toolCall("tc-1", 0, "agent-a")];

    const entries = groupIntoBursts(items);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe("burst");
    if (entries[0]?.type === "burst") {
      expect(entries[0].id).toBe("tc-1");
      expect(entries[0].items).toHaveLength(1);
      expect(entries[0].toolBreakdown).toEqual({ read: 1 });
      expect(entries[0].pendingCount).toBe(0);
      expect(entries[0].errorCount).toBe(0);
      expect(entries[0].durationMs).toBe(0);
    }
  });

  it("groups 10 consecutive reads from same agent into one burst", () => {
    const items: ActivityItem[] = Array.from({ length: 10 }, (_, index) =>
      toolCall(`tc-${index + 1}`, index, "agent-a", "read")
    );

    const entries = groupIntoBursts(items);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe("burst");
    if (entries[0]?.type === "burst") {
      expect(entries[0].items).toHaveLength(10);
      expect(entries[0].toolBreakdown).toEqual({ read: 10 });
    }
  });

  it("starts a new burst when agent changes", () => {
    const items: ActivityItem[] = [
      ...Array.from({ length: 5 }, (_, index) =>
        toolCall(`a-${index + 1}`, index, "agent-a", "read")
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        toolCall(`b-${index + 1}`, index + 5, "agent-b", "read")
      ),
    ];

    const entries = groupIntoBursts(items);

    expect(entries).toHaveLength(2);
    expect(entries[0]?.type).toBe("burst");
    expect(entries[1]?.type).toBe("burst");
    if (entries[0]?.type === "burst" && entries[1]?.type === "burst") {
      expect(entries[0].agentName).toBe("agent-a");
      expect(entries[0].items).toHaveLength(5);
      expect(entries[1].agentName).toBe("agent-b");
      expect(entries[1].items).toHaveLength(3);
    }
  });

  it("keeps error tool calls in bursts", () => {
    const items: ActivityItem[] = [
      toolCall("tc-1", 0, "agent-a"),
      toolCall("tc-2", 1, "agent-a"),
      toolCall("tc-3", 2, "agent-a"),
      toolCall("tc-err", 3, "agent-a", "read", "error"),
    ];

    const entries = groupIntoBursts(items);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe("burst");
    if (entries[0]?.type === "burst") {
      expect(entries[0].items).toHaveLength(4);
      expect(entries[0].errorCount).toBe(1);
      expect(entries[0].items[3]?.id).toBe("tc-err");
      expect(entries[0].items[3]?.state).toBe("error");
    }
  });

  it("splits into burst-milestone-burst around agent-spawn", () => {
    const items: ActivityItem[] = [
      toolCall("tc-1", 0, "agent-a", "read"),
      toolCall("tc-2", 1, "agent-a", "read"),
      agentSpawn("spawn-1", 2, "agent-a", "agent-b"),
      toolCall("tc-3", 3, "agent-a", "edit"),
    ];

    const entries = groupIntoBursts(items);

    expect(entries).toHaveLength(3);
    expect(entries[0]?.type).toBe("burst");
    expect(entries[1]?.type).toBe("milestone");
    expect(entries[2]?.type).toBe("burst");
  });

  it("splits into burst-milestone-burst around agent-complete", () => {
    const items: ActivityItem[] = [
      toolCall("tc-1", 0, "agent-a", "read"),
      toolCall("tc-2", 1, "agent-a", "read"),
      agentComplete("complete-1", 2, "agent-a"),
      toolCall("tc-3", 3, "agent-a", "edit"),
    ];

    const entries = groupIntoBursts(items);

    expect(entries).toHaveLength(3);
    expect(entries[0]?.type).toBe("burst");
    expect(entries[1]?.type).toBe("milestone");
    expect(entries[2]?.type).toBe("burst");
  });

  it("computes tool breakdown for mixed tools in one agent burst", () => {
    const items: ActivityItem[] = [
      toolCall("tc-1", 0, "agent-a", "read"),
      toolCall("tc-2", 1, "agent-a", "read"),
      toolCall("tc-3", 2, "agent-a", "read"),
      toolCall("tc-4", 3, "agent-a", "edit"),
      toolCall("tc-5", 4, "agent-a", "grep"),
      toolCall("tc-6", 5, "agent-a", "grep"),
    ];

    const entries = groupIntoBursts(items);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe("burst");
    if (entries[0]?.type === "burst") {
      expect(entries[0].toolBreakdown).toEqual({ read: 3, edit: 1, grep: 2 });
    }
  });

  it("counts pending tool calls inside burst", () => {
    const items: ActivityItem[] = [
      toolCall("tc-1", 0, "agent-a", "read", "pending"),
      toolCall("tc-2", 1, "agent-a", "read", "complete"),
      toolCall("tc-3", 2, "agent-a", "edit", "pending"),
    ];

    const entries = groupIntoBursts(items);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe("burst");
    if (entries[0]?.type === "burst") {
      expect(entries[0].pendingCount).toBe(2);
      expect(entries[0].errorCount).toBe(0);
    }
  });

  it("calculates duration from first to last tool call timestamp", () => {
    const items: ActivityItem[] = [
      toolCall("tc-1", 5, "agent-a", "read"),
      toolCall("tc-2", 9, "agent-a", "read"),
      toolCall("tc-3", 16, "agent-a", "read"),
    ];

    const entries = groupIntoBursts(items);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe("burst");
    if (entries[0]?.type === "burst") {
      expect(entries[0].durationMs).toBe(11000);
      expect(entries[0].firstTimestamp.getTime()).toBe(ts(5).getTime());
      expect(entries[0].lastTimestamp.getTime()).toBe(ts(16).getTime());
    }
  });

  it("keeps burst items in chronological input order", () => {
    const items: ActivityItem[] = [
      toolCall("tc-1", 0, "agent-a", "read"),
      toolCall("tc-2", 1, "agent-a", "edit"),
      toolCall("tc-3", 2, "agent-a", "grep"),
    ];

    const entries = groupIntoBursts(items);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.type).toBe("burst");
    if (entries[0]?.type === "burst") {
      expect(entries[0].items.map((item) => item.id)).toEqual([
        "tc-1",
        "tc-2",
        "tc-3",
      ]);
    }
  });

  describe("timestamp coercion", () => {
    it("handles string timestamps from JSON parsing", () => {
      const items: ActivityItem[] = [
        {
          ...toolCall("tc-1", 0, "agent-a"),
          timestamp: "2025-01-01T00:00:00.000Z" as unknown as Date,
        },
        {
          ...toolCall("tc-2", 0, "agent-a"),
          timestamp: "2025-01-01T00:00:05.000Z" as unknown as Date,
        },
      ];

      const entries = groupIntoBursts(items);

      expect(entries).toHaveLength(1);
      expect(entries[0]?.type).toBe("burst");
      if (entries[0]?.type === "burst") {
        expect(entries[0].durationMs).toBe(5000);
        expect(Number.isNaN(entries[0].firstTimestamp.getTime())).toBe(false);
        expect(Number.isNaN(entries[0].lastTimestamp.getTime())).toBe(false);
        expect(entries[0].firstTimestamp.toISOString()).toBe("2025-01-01T00:00:00.000Z");
        expect(entries[0].lastTimestamp.toISOString()).toBe("2025-01-01T00:00:05.000Z");
      }
    });

    it("handles mixed Date and string timestamps", () => {
      const items: ActivityItem[] = [
        {
          ...toolCall("tc-1", 0, "agent-a"),
          timestamp: new Date("2025-01-01T00:00:00.000Z"),
        },
        {
          ...toolCall("tc-2", 0, "agent-a"),
          timestamp: "2025-01-01T00:00:02.000Z" as unknown as Date,
        },
      ];

      const entries = groupIntoBursts(items);

      expect(entries).toHaveLength(1);
      expect(entries[0]?.type).toBe("burst");
      if (entries[0]?.type === "burst") {
        expect(entries[0].items).toHaveLength(2);
        expect(entries[0].items.map((item) => item.id)).toEqual(["tc-1", "tc-2"]);
        expect(entries[0].durationMs).toBe(2000);
      }
    });
  });
});
