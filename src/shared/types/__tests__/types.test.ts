import { describe, it, expect } from "bun:test";
import type { SessionStatus, ActivitySession } from "../index";

describe("SessionStatus type", () => {
  it("should include 'waiting' status", () => {
    const waitingStatus: SessionStatus = "waiting";
    expect(waitingStatus).toBe("waiting");
  });

  it("should include all expected statuses", () => {
    const statuses: SessionStatus[] = [
      "working",
      "idle",
      "completed",
      "waiting",
    ];
    expect(statuses).toHaveLength(4);
  });
});

describe("ActivitySession interface", () => {
  it("should have lastToolCompletedAt optional field", () => {
    const session: ActivitySession = {
      id: "test-1",
      title: "Test Session",
      agent: "test-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastToolCompletedAt: new Date(),
    };
    expect(session.lastToolCompletedAt).toBeDefined();
    expect(session.lastToolCompletedAt).toBeInstanceOf(Date);
  });

  it("should have workingChildCount optional field", () => {
    const session: ActivitySession = {
      id: "test-2",
      title: "Test Session",
      agent: "test-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
      workingChildCount: 3,
    };
    expect(session.workingChildCount).toBe(3);
  });

  it("should allow both new fields together", () => {
    const session: ActivitySession = {
      id: "test-3",
      title: "Test Session",
      agent: "test-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastToolCompletedAt: new Date(),
      workingChildCount: 2,
    };
    expect(session.lastToolCompletedAt).toBeDefined();
    expect(session.workingChildCount).toBe(2);
  });

  it("should work without new fields (backwards compatible)", () => {
    const session: ActivitySession = {
      id: "test-4",
      title: "Test Session",
      agent: "test-agent",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(session.id).toBe("test-4");
    expect(session.lastToolCompletedAt).toBeUndefined();
    expect(session.workingChildCount).toBeUndefined();
  });
});
