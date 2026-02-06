import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  parseSession,
  getSession,
  listSessions,
  getStoragePath,
} from "../sessionParser";
import { parseMessage, getMessage, listMessages } from "../messageParser";
import { parsePart, getPart } from "../partParser";
import { parseBoulder, calculatePlanProgress } from "../boulderParser";

const TEST_DIR = "/tmp/ocwatch-test";
const STORAGE_DIR = join(TEST_DIR, "opencode", "storage");
const PROJECT_ID = "test-project-123";
const SESSION_ID = "ses_test123";
const MESSAGE_ID = "msg_test456";
const PART_ID = "prt_test789";

beforeAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(join(STORAGE_DIR, "session", PROJECT_ID), { recursive: true });
  await mkdir(join(STORAGE_DIR, "message", SESSION_ID), { recursive: true });
  await mkdir(join(STORAGE_DIR, "part"), { recursive: true });
  await mkdir(join(TEST_DIR, ".sisyphus"), { recursive: true });
});

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("sessionParser", () => {
  test("parseSession - valid session JSON", async () => {
    const sessionPath = join(
      STORAGE_DIR,
      "session",
      PROJECT_ID,
      `${SESSION_ID}.json`
    );
    const sessionData = {
      id: SESSION_ID,
      slug: "test-session",
      version: "1.0.0",
      projectID: PROJECT_ID,
      directory: "/test/dir",
      title: "Test Session",
      time: {
        created: 1700000000000,
        updated: 1700000001000,
      },
    };

    await writeFile(sessionPath, JSON.stringify(sessionData));

    const result = await parseSession(sessionPath);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(SESSION_ID);
    expect(result?.projectID).toBe(PROJECT_ID);
    expect(result?.title).toBe("Test Session");
    expect(result?.directory).toBe("/test/dir");
    expect(result?.createdAt).toBeInstanceOf(Date);
    expect(result?.updatedAt).toBeInstanceOf(Date);
    expect(result?.parentID).toBeUndefined();
  });

  test("parseSession - reads parentID from JSON", async () => {
    const childSessionPath = join(
      STORAGE_DIR,
      "session",
      PROJECT_ID,
      "ses_child.json"
    );
    const sessionData = {
      id: "ses_child",
      slug: "child-session",
      projectID: PROJECT_ID,
      directory: "/test/dir",
      title: "Child Session",
      parentID: "ses_parent123",
      time: {
        created: 1700000000000,
        updated: 1700000001000,
      },
    };

    await writeFile(childSessionPath, JSON.stringify(sessionData));

    const result = await parseSession(childSessionPath);

    expect(result).not.toBeNull();
    expect(result?.parentID).toBe("ses_parent123");
  });

  test("parseSession - missing file returns null", async () => {
    const result = await parseSession("/nonexistent/path.json");
    expect(result).toBeNull();
  });

  test("parseSession - invalid JSON returns null", async () => {
    const invalidPath = join(STORAGE_DIR, "session", PROJECT_ID, "invalid.json");
    await writeFile(invalidPath, "{ invalid json }");

    const result = await parseSession(invalidPath);
    expect(result).toBeNull();
  });

  test("getSession - retrieves session by ID", async () => {
    const result = await getSession(PROJECT_ID, SESSION_ID, TEST_DIR);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(SESSION_ID);
  });

  test("listSessions - returns all sessions for project", async () => {
    const session2Path = join(
      STORAGE_DIR,
      "session",
      PROJECT_ID,
      "ses_test456.json"
    );
    await writeFile(
      session2Path,
      JSON.stringify({
        id: "ses_test456",
        projectID: PROJECT_ID,
        directory: "/test",
        title: "Session 2",
        time: { created: 1700000000000, updated: 1700000000000 },
      })
    );

    const result = await listSessions(PROJECT_ID, TEST_DIR);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((s) => s.id === SESSION_ID)).toBe(true);
    expect(result.some((s) => s.id === "ses_test456")).toBe(true);
  });

  test("listSessions - returns empty array for nonexistent project", async () => {
    const result = await listSessions("nonexistent-project", TEST_DIR);
    expect(result).toEqual([]);
  });

  test("getStoragePath - respects XDG_DATA_HOME", () => {
    const originalXDG = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = "/custom/path";

    const result = getStoragePath();
    expect(result).toBe("/custom/path");

    process.env.XDG_DATA_HOME = originalXDG;
  });
});

describe("messageParser", () => {
  test("parseMessage - valid message JSON", async () => {
    const messagePath = join(STORAGE_DIR, "message", SESSION_ID, `${MESSAGE_ID}.json`);
    const messageData = {
      id: MESSAGE_ID,
      sessionID: SESSION_ID,
      role: "assistant",
      time: {
        created: 1700000000000,
        completed: 1700000001000,
      },
      parentID: "msg_parent123",
      modelID: "claude-sonnet-4",
      providerID: "anthropic",
      mode: "explore",
      agent: "explore",
      tokens: {
        input: 100,
        output: 200,
        reasoning: 50,
      },
    };

    await writeFile(messagePath, JSON.stringify(messageData));

    const result = await parseMessage(messagePath);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(MESSAGE_ID);
    expect(result?.sessionID).toBe(SESSION_ID);
    expect(result?.role).toBe("assistant");
    expect(result?.agent).toBe("explore");
    expect(result?.mode).toBe("explore");
    expect(result?.modelID).toBe("claude-sonnet-4");
    expect(result?.parentID).toBe("msg_parent123");
    expect(result?.tokens).toBe(300);
    expect(result?.createdAt).toBeInstanceOf(Date);
  });

  test("parseMessage - missing tokens field", async () => {
    const messagePath = join(STORAGE_DIR, "message", SESSION_ID, "msg_notoken.json");
    const messageData = {
      id: "msg_notoken",
      sessionID: SESSION_ID,
      role: "user",
      time: { created: 1700000000000 },
    };

    await writeFile(messagePath, JSON.stringify(messageData));

    const result = await parseMessage(messagePath);

    expect(result).not.toBeNull();
    expect(result?.tokens).toBeUndefined();
  });

  test("parseMessage - extracts cost field", async () => {
    const messagePath = join(STORAGE_DIR, "message", SESSION_ID, "msg_withcost.json");
    const messageData = {
      id: "msg_withcost",
      sessionID: SESSION_ID,
      role: "assistant",
      time: { created: 1700000000000 },
      cost: 0.0234,
      tokens: {
        input: 100,
        output: 200,
      },
    };

    await writeFile(messagePath, JSON.stringify(messageData));

    const result = await parseMessage(messagePath);

    expect(result).not.toBeNull();
    expect(result?.cost).toBe(0.0234);
  });

  test("parseMessage - missing cost field", async () => {
    const messagePath = join(STORAGE_DIR, "message", SESSION_ID, "msg_nocost.json");
    const messageData = {
      id: "msg_nocost",
      sessionID: SESSION_ID,
      role: "assistant",
      time: { created: 1700000000000 },
    };

    await writeFile(messagePath, JSON.stringify(messageData));

    const result = await parseMessage(messagePath);

    expect(result).not.toBeNull();
    expect(result?.cost).toBeUndefined();
  });

  test("getMessage - retrieves message by ID", async () => {
    const result = await getMessage(MESSAGE_ID, SESSION_ID, TEST_DIR);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(MESSAGE_ID);
  });

  test("listMessages - filters by sessionID", async () => {
    const message2Path = join(STORAGE_DIR, "message", SESSION_ID, "msg_test999.json");
    await writeFile(
      message2Path,
      JSON.stringify({
        id: "msg_test999",
        sessionID: SESSION_ID,
        role: "user",
        time: { created: 1700000000000 },
      })
    );

    const result = await listMessages(SESSION_ID, TEST_DIR);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.every((m) => m.sessionID === SESSION_ID)).toBe(true);
  });
});

describe("partParser", () => {
  test("parsePart - valid part JSON", async () => {
    const partPath = join(STORAGE_DIR, "part", `${PART_ID}.json`);
    const partData = {
      id: PART_ID,
      sessionID: SESSION_ID,
      messageID: MESSAGE_ID,
      type: "tool-call",
      callID: "call_123",
      tool: "mcp_read",
      state: "complete",
      text: "Tool output",
    };

    await writeFile(partPath, JSON.stringify(partData));

    const result = await parsePart(partPath);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(PART_ID);
    expect(result?.sessionID).toBe(SESSION_ID);
    expect(result?.messageID).toBe(MESSAGE_ID);
    expect(result?.type).toBe("tool-call");
    expect(result?.callID).toBe("call_123");
    expect(result?.tool).toBe("mcp_read");
    expect(result?.state).toBe("complete");
  });

  test("getPart - lazy loads single part", async () => {
    const result = await getPart(PART_ID, TEST_DIR);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(PART_ID);
  });

  test("parsePart - missing file returns null", async () => {
    const result = await parsePart("/nonexistent/part.json");
    expect(result).toBeNull();
  });
});

describe("boulderParser", () => {
  test("parseBoulder - valid boulder.json", async () => {
    const boulderPath = join(TEST_DIR, ".sisyphus", "boulder.json");
    const boulderData = {
      activePlan: ".sisyphus/plans/test-plan.md",
      sessionIDs: [SESSION_ID, "ses_other"],
      status: "in-progress",
      startedAt: 1700000000000,
      planName: "test-plan",
    };

    await writeFile(boulderPath, JSON.stringify(boulderData));

    const result = await parseBoulder(TEST_DIR);

    expect(result).not.toBeNull();
    expect(result?.activePlan).toContain("test-plan.md");
    expect(result?.sessionIDs).toEqual([SESSION_ID, "ses_other"]);
    expect(result?.status).toBe("in-progress");
    expect(result?.planName).toBe("test-plan");
    expect(result?.startedAt).toBeInstanceOf(Date);
  });

  test("parseBoulder - missing file returns null", async () => {
    const result = await parseBoulder("/nonexistent/dir");
    expect(result).toBeNull();
  });

  test("calculatePlanProgress - counts checkboxes", async () => {
    const planPath = join(TEST_DIR, ".sisyphus", "plans", "test-plan.md");
    await mkdir(join(TEST_DIR, ".sisyphus", "plans"), { recursive: true });

    const planContent = `# Test Plan

- [x] Task 1 completed
- [ ] Task 2 pending
- [X] Task 3 completed
- [ ] Task 4 pending

Some other content
- [x] Task 5 completed
`;

    await writeFile(planPath, planContent);

    const result = await calculatePlanProgress(planPath);

    expect(result).not.toBeNull();
    expect(result?.total).toBe(5);
    expect(result?.completed).toBe(3);
    expect(result?.progress).toBe(60);
    expect(result?.tasks).toHaveLength(5);
    expect(result?.tasks[0]).toEqual({ description: "Task 1 completed", completed: true });
  });

  test("calculatePlanProgress - empty plan", async () => {
    const planPath = join(TEST_DIR, ".sisyphus", "plans", "empty-plan.md");
    await writeFile(planPath, "# Empty Plan\n\nNo tasks here.");

    const result = await calculatePlanProgress(planPath);

    expect(result).not.toBeNull();
    expect(result?.total).toBe(0);
    expect(result?.completed).toBe(0);
    expect(result?.progress).toBe(0);
    expect(result?.tasks).toEqual([]);
  });

  test("calculatePlanProgress - missing file returns null", async () => {
    const result = await calculatePlanProgress("/nonexistent/plan.md");
    expect(result).toBeNull();
  });
});
