import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveProjectDirectory } from "../projectResolver";

const TEST_DIR = "/tmp/ocwatch-project-resolver-test";

const originalXdgDataHome = process.env.XDG_DATA_HOME;

function restoreXdgDataHome(): void {
  if (originalXdgDataHome === undefined) {
    delete process.env.XDG_DATA_HOME;
    return;
  }

  process.env.XDG_DATA_HOME = originalXdgDataHome;
}

async function writeSession(
  basePath: string,
  projectId: string,
  sessionId: string,
  directory: string
): Promise<void> {
  const sessionDir = join(basePath, "opencode", "storage", "session", projectId);
  await mkdir(sessionDir, { recursive: true });

  await writeFile(
    join(sessionDir, `${sessionId}.json`),
    JSON.stringify({
      id: sessionId,
      slug: sessionId,
      projectID: projectId,
      directory,
      title: "Test Session",
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    })
  );
}

describe("resolveProjectDirectory", () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
    process.env.XDG_DATA_HOME = TEST_DIR;
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    restoreXdgDataHome();
  });

  it("returns project directory when project exists and directory is valid", async () => {
    const projectId = "project-alpha";
    const projectDirectory = join(TEST_DIR, "workspace", "project-alpha");
    await mkdir(projectDirectory, { recursive: true });

    await writeSession(TEST_DIR, projectId, "ses_alpha123", projectDirectory);

    const result = await resolveProjectDirectory(projectId);

    expect(result).toBe(projectDirectory);
  });

  it("returns null for unknown project id", async () => {
    const projectDirectory = join(TEST_DIR, "workspace", "project-alpha");
    await mkdir(projectDirectory, { recursive: true });

    await writeSession(TEST_DIR, "project-alpha", "ses_alpha123", projectDirectory);

    const result = await resolveProjectDirectory("project-missing");

    expect(result).toBeNull();
  });

  it("returns null when project directory does not exist", async () => {
    const missingDirectory = join(TEST_DIR, "workspace", "project-missing-dir");
    await writeSession(TEST_DIR, "project-alpha", "ses_alpha123", missingDirectory);

    const result = await resolveProjectDirectory("project-alpha");

    expect(result).toBeNull();
  });
});
