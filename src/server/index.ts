import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import {
  listAllSessions,
  listProjects,
} from "./storage/sessionParser";
import { listMessages } from "./storage/messageParser";
import type { SessionMetadata, MessageMeta } from "../shared/types";

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

// CORS middleware - localhost only (restrictive)
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

// Session endpoints
app.get("/api/sessions", async (c) => {
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

  const sessionsWithActivity = await Promise.all(
    limitedSessions.map(async (session) => {
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

// Static file serving for client build
app.use("/*", serveStatic({ root: "./src/client/dist" }));

// Export app for testing
export { app };

// Start server
const port = 50234;

export default {
  port,
  fetch: app.fetch,
};

console.log(`🚀 OCWatch server running on http://localhost:${port}`);
