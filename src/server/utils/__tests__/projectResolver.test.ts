import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { resolveProjectDirectory } from "../projectResolver";
import type { SessionMetadata } from "../../../shared/types";

const TEST_DIR = "/tmp/ocwatch-project-resolver-test";

function makeSession(
  projectId: string,
  sessionId: string,
  directory: string,
): SessionMetadata {
  return {
    id: sessionId,
    projectID: projectId,
    directory,
    title: "Test Session",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("resolveProjectDirectory", () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("returns project directory when project exists and directory is valid", async () => {
    const projectId = "project-alpha";
    const projectDirectory = join(TEST_DIR, "workspace", "project-alpha");
    await mkdir(projectDirectory, { recursive: true });

    const sessions = [makeSession(projectId, "ses_alpha123", projectDirectory)];
    const result = await resolveProjectDirectory(projectId, sessions);

    expect(result).toBe(projectDirectory);
  });

  it("returns null for unknown project id", async () => {
    const projectDirectory = join(TEST_DIR, "workspace", "project-alpha");
    await mkdir(projectDirectory, { recursive: true });

    const sessions = [makeSession("project-alpha", "ses_alpha123", projectDirectory)];
    const result = await resolveProjectDirectory("project-missing", sessions);

    expect(result).toBeNull();
  });

  it("returns null when project directory does not exist", async () => {
    const missingDirectory = join(TEST_DIR, "workspace", "project-missing-dir");

    const sessions = [makeSession("project-alpha", "ses_alpha123", missingDirectory)];
    const result = await resolveProjectDirectory("project-alpha", sessions);

    expect(result).toBeNull();
  });
});
