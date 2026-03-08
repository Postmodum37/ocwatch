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
import { queryProjectByWorktree, closeDb } from "./storage";

const clientDistPath = join(import.meta.dir, "..", "client", "dist");
const flags = parseArgs();

if (flags.showHelp) {
  printHelp();
  process.exit(0);
}

// Start watcher eagerly so fs events are captured before the first request
getGlobalWatcher();

function normalizeDirectoryPath(pathValue: string): string {
  return normalize(resolve(pathValue));
}

function resolveDefaultProjectId(projectPath: string): string | undefined {
  const normalizedPath = normalizeDirectoryPath(projectPath);
  const project = queryProjectByWorktree(normalizedPath);
  return project?.id;
}

async function getDefaultProjectIdFromFlag(projectPath: string | null): Promise<string | undefined> {
  if (!projectPath) {
    return undefined;
  }

  try {
    const defaultProjectId = resolveDefaultProjectId(projectPath);
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

const isWildcard = flags.host === "0.0.0.0" || flags.host === "::";

const app = new Hono();

app.use("*", compress());
app.use("*", errorHandler);

app.use(
  "/api/*",
  cors(
    isWildcard
      ? { origin: "*", credentials: false }
      : {
          origin: [
            `http://localhost:3000`,
            `http://localhost:${flags.port}`,
            `http://${flags.host}:${flags.port}`,
          ],
          credentials: true,
        }
  )
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
const hostname = flags.host;
const displayHost = isWildcard ? "localhost" : hostname;
const url = `http://${displayHost}:${port}`;

export default {
  port,
  hostname,
  fetch: app.fetch,
};

function shutdown() {
  console.log("\n🛑 Shutting down gracefully...");
  try {
    getGlobalWatcher().stop();
  } catch (error) {
    console.warn('[shutdown] Failed to stop watcher:', error instanceof Error ? error.message : error);
  }
  try {
    closeAllSSEConnections();
  } catch (error) {
    console.warn('[shutdown] Failed to close SSE connections:', error instanceof Error ? error.message : error);
  }
  try {
    closeDb();
  } catch (error) {
    console.warn('[shutdown] Failed to close database:', error instanceof Error ? error.message : error);
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`🚀 OCWatch API server running on ${url}`);
if (flags.noBrowser) {
  console.log(`📡 API ready for Vite dev server`);
} else {
  console.log(`📋 Press Ctrl+C to stop`);
  openBrowser(url).catch((error) => {
    console.warn('[ocwatch] Failed to open browser:', error instanceof Error ? error.message : error);
  });
}
