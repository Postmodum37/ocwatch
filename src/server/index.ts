#!/usr/bin/env bun
import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serveStatic } from "hono/bun";
import { join, normalize, resolve } from "path";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { registerRoutes } from "./routes";
import { parseArgs, printHelp, openBrowser } from "./cli";
import { getGlobalWatcher, closeAllSSEConnections } from "./routes/sse";
import { listAllSessions } from "./storage";

const clientDistPath = join(import.meta.dir, "..", "client", "dist");
const flags = parseArgs();

if (flags.showHelp) {
  printHelp();
  process.exit(0);
}

function normalizeDirectoryPath(pathValue: string): string {
  return normalize(resolve(pathValue));
}

async function resolveDefaultProjectId(projectPath: string): Promise<string | undefined> {
  const knownSessions = await listAllSessions();
  const requestedPath = normalizeDirectoryPath(projectPath);
  const seenProjectDirectories = new Map<string, string>();

  for (const session of knownSessions) {
    if (!session.directory || seenProjectDirectories.has(session.projectID)) {
      continue;
    }
    seenProjectDirectories.set(
      session.projectID,
      normalizeDirectoryPath(session.directory)
    );
  }

  for (const [projectID, directory] of seenProjectDirectories) {
    if (directory === requestedPath) {
      return projectID;
    }
  }

  return undefined;
}

async function getDefaultProjectIdFromFlag(projectPath: string | null): Promise<string | undefined> {
  if (!projectPath) {
    return undefined;
  }

  try {
    const defaultProjectId = await resolveDefaultProjectId(projectPath);
    if (!defaultProjectId) {
      console.warn(
        `[ocwatch] --project path did not match any known project directory: ${projectPath}`
      );
    }
    return defaultProjectId;
  } catch (error) {
    console.warn(
      `[ocwatch] Failed to resolve --project path to a known project ID: ${projectPath}`
    );
    return undefined;
  }
}

const defaultProjectIdPromise = getDefaultProjectIdFromFlag(flags.projectPath);

const app = new Hono();

app.use("*", compress());
app.use("*", errorHandler);

app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:50234"],
    credentials: true,
  })
);

registerRoutes(app, { defaultProjectIdPromise });

app.use("/*", serveStatic({ root: clientDistPath }));

app.notFound(async (c) => {
  if (c.req.path.startsWith("/api/")) {
    return notFoundHandler(c);
  }
  const indexPath = join(clientDistPath, "index.html");
  const file = Bun.file(indexPath);
  if (await file.exists()) {
    return new Response(file, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return notFoundHandler(c);
});

export { app };

const port = flags.port;
const url = `http://localhost:${port}`;

export default {
  port,
  fetch: app.fetch,
};

function shutdown() {
  console.log("\n🛑 Shutting down gracefully...");
  try { getGlobalWatcher().stop(); } catch {}
  try { closeAllSSEConnections(); } catch {}
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`🚀 OCWatch API server running on ${url}`);
if (flags.noBrowser) {
  console.log(`📡 API ready for Vite dev server`);
} else {
  console.log(`📋 Press Ctrl+C to stop`);
  openBrowser(url).catch(() => {});
}
