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
});
