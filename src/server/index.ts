import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { createHash } from "node:crypto";
import {
  listAllSessions,
  listProjects,
  checkStorageExists,
} from "./storage/sessionParser";
import { listMessages, getFirstAssistantMessage } from "./storage/messageParser";
import { parseBoulder, calculatePlanProgress } from "./storage/boulderParser";
import type { SessionMetadata, MessageMeta, PlanProgress, ActivitySession } from "../shared/types";
import { errorHandler, notFoundHandler } from "./middleware/error";

interface TreeNode {
  id: string;
  data: {
    title: string;
    agent?: string;
    model?: string;
    isActive: boolean;
  };
}

interface TreeEdge {
  source: string;
  target: string;
}

interface SessionTree {
  nodes: TreeNode[];
  edges: TreeEdge[];
}

function buildAgentHierarchy(messages: MessageMeta[]): Record<string, string[]> {
  const hierarchy: Record<string, string[]> = {};

  for (const msg of messages) {
    if (msg.agent && msg.parentID) {
      const parentMsg = messages.find((m) => m.id === msg.parentID);
      if (parentMsg?.agent) {
        if (!hierarchy[parentMsg.agent]) {
          hierarchy[parentMsg.agent] = [];
        }
        if (!hierarchy[parentMsg.agent].includes(msg.agent)) {
          hierarchy[parentMsg.agent].push(msg.agent);
        }
      }
    }
  }

  return hierarchy;
}

async function buildSessionTree(
  rootSessionID: string,
  allSessions: SessionMetadata[]
): Promise<SessionTree> {
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  const visited = new Set<string>();

  async function processSession(sessionID: string) {
    if (visited.has(sessionID)) {
      return;
    }
    visited.add(sessionID);

    const session = allSessions.find((s) => s.id === sessionID);
    if (!session) {
      return;
    }

    const messages = await listMessages(sessionID);
    const lastMessage = messages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0];

    const now = Date.now();
    const isActive = lastMessage
      ? now - lastMessage.createdAt.getTime() < 5 * 60 * 1000
      : false;

    nodes.push({
      id: session.id,
      data: {
        title: session.title,
        agent: lastMessage?.agent,
        model: lastMessage?.modelID,
        isActive,
      },
    });

    if (session.parentID) {
      edges.push({
        source: session.parentID,
        target: session.id,
      });
      await processSession(session.parentID);
    }

    const children = allSessions.filter((s) => s.parentID === sessionID);
    for (const child of children) {
      edges.push({
        source: sessionID,
        target: child.id,
      });
      await processSession(child.id);
    }
  }

  await processSession(rootSessionID);

  return { nodes, edges };
}

const app = new Hono();

app.use("*", errorHandler);

app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:50234"],
    credentials: true,
  })
);

// Health check endpoint
app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/api/sessions", async (c) => {
  const storageExists = await checkStorageExists();
  if (!storageExists) {
    return c.json({ 
      error: "OpenCode storage not found",
      message: "OpenCode storage directory does not exist. Please ensure OpenCode is installed.",
      sessions: []
    }, 200);
  }

  const allSessions = await listAllSessions();

  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  const recentSessions = allSessions.filter(
    (s) => s.updatedAt.getTime() >= twentyFourHoursAgo
  );

  const sortedSessions = recentSessions.sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );

  const limitedSessions = sortedSessions.slice(0, 20);
  const rootSessions = limitedSessions.filter(s => !s.parentID);

  const sessionsWithActivity = await Promise.all(
    rootSessions.map(async (session) => {
      const messages = await listMessages(session.id);
      const lastMessage = messages.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];

      const isActive = lastMessage
        ? now - lastMessage.createdAt.getTime() < 5 * 60 * 1000
        : false;

      return {
        id: session.id,
        title: session.title,
        projectID: session.projectID,
        parentID: session.parentID,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        isActive,
      };
    })
  );

  return c.json(sessionsWithActivity);
});

app.get("/api/sessions/:id", async (c) => {
  const sessionID = c.req.param("id");

  const allSessions = await listAllSessions();
  const session = allSessions.find((s) => s.id === sessionID);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const messages = await listMessages(sessionID);
  const agentHierarchy = buildAgentHierarchy(messages);

  return c.json({
    ...session,
    agentHierarchy,
  });
});

app.get("/api/sessions/:id/messages", async (c) => {
  const sessionID = c.req.param("id");

  const allSessions = await listAllSessions();
  const session = allSessions.find((s) => s.id === sessionID);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const messages = await listMessages(sessionID);

  const sortedMessages = messages.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const limitedMessages = sortedMessages.slice(0, 100);

  return c.json(limitedMessages);
});

app.get("/api/sessions/:id/tree", async (c) => {
  const sessionID = c.req.param("id");

  const allSessions = await listAllSessions();
  const session = allSessions.find((s) => s.id === sessionID);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const tree = await buildSessionTree(sessionID, allSessions);

  return c.json(tree);
});

// Part file endpoint (stub)
app.get("/api/parts/:id", (c) => {
  return c.json(null);
});

// Plan progress endpoint (stub)
app.get("/api/plan", (c) => {
  return c.json(null);
});

// Projects endpoint
app.get("/api/projects", async (c) => {
  const projectIDs = await listProjects();

  const projectsWithDetails = await Promise.all(
    projectIDs.map(async (projectID) => {
      const sessions = await listAllSessions();
      const projectSessions = sessions.filter((s) => s.projectID === projectID);

      const directory = projectSessions[0]?.directory || "";

      return {
        id: projectID,
        directory,
        sessionCount: projectSessions.length,
      };
    })
  );

  return c.json(projectsWithDetails);
});

async function getSessionHierarchy(
  rootSessionId: string,
  allSessions: SessionMetadata[]
): Promise<ActivitySession[]> {
  const result: ActivitySession[] = [];
  const sessionsToProcess = [rootSessionId];
  const processed = new Set<string>();

  while (sessionsToProcess.length > 0) {
    const sessionId = sessionsToProcess.shift()!;
    if (processed.has(sessionId)) continue;
    processed.add(sessionId);

    const session = allSessions.find((s) => s.id === sessionId);
    if (!session) continue;

    const messages = await listMessages(sessionId);
    const firstAssistantMsg = messages
      .filter((m) => m.role === "assistant")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    
    const totalTokens = messages
      .filter((m) => m.tokens !== undefined)
      .reduce((sum, m) => sum + (m.tokens || 0), 0);

    result.push({
      id: session.id,
      title: session.title,
      agent: firstAssistantMsg?.agent || "unknown",
      modelID: firstAssistantMsg?.modelID,
      providerID: firstAssistantMsg?.providerID,
      parentID: session.parentID,
      tokens: totalTokens > 0 ? totalTokens : undefined,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });

    const childSessions = allSessions.filter((s) => s.parentID === sessionId);
    for (const child of childSessions) {
      sessionsToProcess.push(child.id);
    }
  }

  return result;
}

interface PollResponse {
  sessions: SessionMetadata[];
  activeSession: SessionMetadata | null;
  planProgress: PlanProgress | null;
  messages: MessageMeta[];
  activitySessions: ActivitySession[];
  lastUpdate: number;
}

/**
 * Generate ETag from data hash
 * Uses SHA256 hash of JSON stringified data (excluding lastUpdate timestamp)
 */
function generateETag(data: PollResponse): string {
   const dataForHash = {
     sessions: data.sessions,
     activeSession: data.activeSession,
     planProgress: data.planProgress,
     messages: data.messages,
     activitySessions: data.activitySessions,
   };
   const hash = createHash("sha256")
     .update(JSON.stringify(dataForHash))
     .digest("hex");
   return `"${hash.substring(0, 16)}"`;
}

app.get("/api/poll", async (c) => {
   const storageExists = await checkStorageExists();
   if (!storageExists) {
     const pollData: PollResponse = {
       sessions: [],
       activeSession: null,
       planProgress: null,
       messages: [],
       activitySessions: [],
       lastUpdate: Date.now(),
     };
     return c.json(pollData);
   }

   const allSessions = await listAllSessions();

   const now = Date.now();
   const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

   const recentSessions = allSessions.filter(
     (s) => s.updatedAt.getTime() >= twentyFourHoursAgo
   );

   const sortedSessions = recentSessions.sort(
     (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
   );

    const limitedSessions = sortedSessions.slice(0, 20);
    const rootSessions = limitedSessions.filter(s => !s.parentID);

    // Enrich sessions with agent and modelID from first assistant message
    const sessionsWithAgent = await Promise.all(
      rootSessions.map(async (session) => {
        const firstAssistantMsg = await getFirstAssistantMessage(session.id);
         return {
           ...session,
           agent: firstAssistantMsg?.agent || null,
           modelID: firstAssistantMsg?.modelID || null,
           providerID: firstAssistantMsg?.providerID || null,
         };
      })
    );

    // Find active session (most recent with activity < 5 minutes)
    let activeSession: SessionMetadata | null = null;
    for (const session of rootSessions) {
      const messages = await listMessages(session.id);
      const lastMessage = messages.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];

      if (lastMessage && now - lastMessage.createdAt.getTime() < 5 * 60 * 1000) {
        activeSession = session;
        break;
      }
    }

    // Get plan progress from current directory
    let planProgress: PlanProgress | null = null;
    try {
      const cwd = process.cwd();
      const boulder = await parseBoulder(cwd);
      if (boulder?.activePlan) {
        planProgress = await calculatePlanProgress(boulder.activePlan);
      }
    } catch (error) {
      // Silently fail if no plan found
    }

    // Fetch messages for target session
    let messages: MessageMeta[] = [];
    let activitySessions: ActivitySession[] = [];
    const sessionId = c.req.query('sessionId');
    const targetSessionId = sessionId || activeSession?.id;
    if (targetSessionId) {
      const fetchedMessages = await listMessages(targetSessionId);
      const sortedMessages = fetchedMessages.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      messages = sortedMessages.slice(0, 100);
      
      activitySessions = await getSessionHierarchy(targetSessionId, allSessions);
    }

    const pollData: PollResponse = {
      sessions: sessionsWithAgent,
      activeSession,
      planProgress,
      messages,
      activitySessions,
      lastUpdate: now,
    };

   // Generate ETag
   const etag = generateETag(pollData);

   // Check If-None-Match header
   const clientETag = c.req.header("If-None-Match");
   if (clientETag === etag) {
     // Data hasn't changed, return 304 Not Modified
     c.header("ETag", etag);
     return new Response(null, { status: 304, headers: { ETag: etag } });
   }

   // Data changed or first request, return 200 with ETag
   c.header("ETag", etag);
   return c.json(pollData);
});

app.use("/*", serveStatic({ root: "./src/client/dist" }));

app.notFound(notFoundHandler);

export { app };

// CLI flag parsing
interface CLIFlags {
  port: number;
  noBrowser: boolean;
  projectPath: string | null;
  showHelp: boolean;
}

function parseArgs(): CLIFlags {
  const args = process.argv.slice(2);
  const flags: CLIFlags = {
    port: 50234,
    noBrowser: false,
    projectPath: null,
    showHelp: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      flags.showHelp = true;
    } else if (arg === "--no-browser") {
      flags.noBrowser = true;
    } else if (arg === "--port") {
      const portValue = args[i + 1];
      if (portValue && !isNaN(parseInt(portValue))) {
        flags.port = parseInt(portValue);
        i++;
      }
    } else if (arg === "--project") {
      const projectPath = args[i + 1];
      if (projectPath) {
        flags.projectPath = projectPath;
        i++;
      }
    }
  }

  return flags;
}

function printHelp(): void {
  console.log(`
OCWatch Server - Real-time OpenCode Activity Monitor

Usage: bun run src/server/index.ts [options]

Options:
  --port <number>      Server port (default: 50234)
  --no-browser         Skip auto-opening browser
  --project <path>     Set default project filter
  --help, -h           Show this help message

Examples:
  bun run src/server/index.ts
  bun run src/server/index.ts --port 50999
  bun run src/server/index.ts --no-browser
  bun run src/server/index.ts --project /path/to/project
`);
}

async function openBrowser(url: string): Promise<void> {
  try {
    // Check if running in headless environment
    const isHeadless =
      !process.env.DISPLAY &&
      !process.env.WAYLAND_DISPLAY &&
      process.env.CI !== "true";

    if (isHeadless) {
      console.log(`📱 Open browser: ${url}`);
      return;
    }

    // macOS only for v1
    const proc = Bun.spawn(["open", url], {
      stdio: ["ignore", "ignore", "ignore"],
    });

    // Wait for process to complete (non-blocking)
    proc.exited.catch(() => {
      // Silently ignore errors
    });
  } catch (error) {
    // Fallback: just print URL
    console.log(`📱 Open browser: ${url}`);
  }
}

// Start server
const flags = parseArgs();

if (flags.showHelp) {
  printHelp();
  process.exit(0);
}

const port = flags.port;
const url = `http://localhost:${port}`;

export default {
  port,
  fetch: app.fetch,
};

console.log(`🚀 OCWatch API server running on ${url}`);
if (flags.noBrowser) {
  console.log(`📡 API ready for Vite dev server`);
} else {
  console.log(`📋 Press Ctrl+C to stop`);
  openBrowser(url).catch(() => {});
}
