import { describe, it, expect } from "bun:test";
import { synthesizeActivityItems } from "../activityUtils";
import type { ActivitySession } from "../../types";

describe("synthesizeActivityItems", () => {
  describe("agent-complete event emission", () => {
    it("should NOT emit agent-complete for status='waiting'", () => {
      const sessions: ActivitySession[] = [
        {
          id: "session-1",
          title: "Test Session",
          agent: "test-agent",
          status: "waiting",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          updatedAt: new Date("2025-01-01T10:05:00Z"),
        },
      ];

      const items = synthesizeActivityItems(sessions);
      const completeItems = items.filter((item) => item.type === "agent-complete");

      expect(completeItems).toHaveLength(0);
    });

    it("should emit agent-complete for status='completed'", () => {
      const sessions: ActivitySession[] = [
        {
          id: "session-1",
          title: "Test Session",
          agent: "test-agent",
          status: "completed",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          updatedAt: new Date("2025-01-01T10:05:00Z"),
        },
      ];

      const items = synthesizeActivityItems(sessions);
      const completeItems = items.filter((item) => item.type === "agent-complete");

      expect(completeItems).toHaveLength(1);
      expect(completeItems[0].type).toBe("agent-complete");
      expect(completeItems[0].status).toBe("completed");
    });

    it("should NOT emit agent-complete for status='working'", () => {
      const sessions: ActivitySession[] = [
        {
          id: "session-1",
          title: "Test Session",
          agent: "test-agent",
          status: "working",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          updatedAt: new Date("2025-01-01T10:05:00Z"),
        },
      ];

      const items = synthesizeActivityItems(sessions);
      const completeItems = items.filter((item) => item.type === "agent-complete");

      expect(completeItems).toHaveLength(0);
    });

    it("should NOT emit agent-complete for status='idle'", () => {
      const sessions: ActivitySession[] = [
        {
          id: "session-1",
          title: "Test Session",
          agent: "test-agent",
          status: "idle",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          updatedAt: new Date("2025-01-01T10:05:00Z"),
        },
      ];

      const items = synthesizeActivityItems(sessions);
      const completeItems = items.filter((item) => item.type === "agent-complete");

      expect(completeItems).toHaveLength(0);
    });

    it("should calculate durationMs correctly for completed sessions", () => {
      const createdAt = new Date("2025-01-01T10:00:00Z");
      const updatedAt = new Date("2025-01-01T10:05:30Z");
      const expectedDurationMs = updatedAt.getTime() - createdAt.getTime();

      const sessions: ActivitySession[] = [
        {
          id: "session-1",
          title: "Test Session",
          agent: "test-agent",
          status: "completed",
          createdAt,
          updatedAt,
        },
      ];

      const items = synthesizeActivityItems(sessions);
      const completeItems = items.filter((item) => item.type === "agent-complete");

      expect(completeItems).toHaveLength(1);
      expect(completeItems[0].durationMs).toBe(expectedDurationMs);
    });
  });

  describe("error field propagation", () => {
    it("should propagate error field from toolCalls to ToolCallActivity", () => {
      const sessions: ActivitySession[] = [
        {
          id: "session-1",
          title: "Test Session",
          agent: "test-agent",
          status: "working",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          updatedAt: new Date("2025-01-01T10:05:00Z"),
          toolCalls: [
            {
              id: "tool-1",
              name: "mcp_read",
              state: "error",
              summary: "Read file",
              input: { filePath: "/test/missing.ts" },
              error: "File not found: /test/missing.ts",
              timestamp: "2025-01-01T10:01:00Z",
              agentName: "test-agent",
            },
          ],
        },
      ];

      const items = synthesizeActivityItems(sessions);
      const toolCallItems = items.filter((item) => item.type === "tool-call");

      expect(toolCallItems).toHaveLength(1);
      expect(toolCallItems[0].type).toBe("tool-call");
      if (toolCallItems[0].type === "tool-call") {
        expect(toolCallItems[0].error).toBe("File not found: /test/missing.ts");
        expect(toolCallItems[0].state).toBe("error");
      }
    });

    it("should not populate error field for successful tool calls", () => {
      const sessions: ActivitySession[] = [
        {
          id: "session-1",
          title: "Test Session",
          agent: "test-agent",
          status: "working",
          createdAt: new Date("2025-01-01T10:00:00Z"),
          updatedAt: new Date("2025-01-01T10:05:00Z"),
          toolCalls: [
            {
              id: "tool-1",
              name: "mcp_read",
              state: "complete",
              summary: "Read file",
              input: { filePath: "/test/file.ts" },
              timestamp: "2025-01-01T10:01:00Z",
              agentName: "test-agent",
            },
          ],
        },
      ];

      const items = synthesizeActivityItems(sessions);
      const toolCallItems = items.filter((item) => item.type === "tool-call");

      expect(toolCallItems).toHaveLength(1);
      expect(toolCallItems[0].type).toBe("tool-call");
      if (toolCallItems[0].type === "tool-call") {
        expect(toolCallItems[0].error).toBeUndefined();
        expect(toolCallItems[0].state).toBe("complete");
      }
    });
  });
});
