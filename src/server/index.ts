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
import { formatCurrentAction, getPartsForSession, getSessionToolState, isPendingToolCall, getToolCallsForSession } from "./storage/partParser";
import { getSessionStatus, getStatusFromTimestamp } from "./utils/sessionStatus";
import type { SessionMetadata, MessageMeta, PlanProgress, ActivitySession, SessionStatus, SessionStats } from "../shared/types";
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

interface AgentPhase {
  agent: string;
  startTime: Date;
  endTime: Date;
  tokens: number;
  messageCount: number;
}

function isAssistantFinished(messages: MessageMeta[]): boolean {
  const assistantMessages = messages.filter(m => m.role === "assistant");
  if (assistantMessages.length === 0) return false;
  const lastAssistant = assistantMessages.reduce((a, b) => 
    a.createdAt.getTime() > b.createdAt.getTime() ? a : b
  );
  return lastAssistant.finish === "stop";
}

function detectAgentPhases(messages: MessageMeta[]): AgentPhase[] {
  const sorted = messages
    .filter(m => m.role === 'assistant' && m.agent)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  
  if (sorted.length === 0) return [];
  
  const phases: AgentPhase[] = [];
  let currentPhase: AgentPhase | null = null;
  
  for (const msg of sorted) {
    if (!currentPhase || currentPhase.agent !== msg.agent) {
      if (currentPhase) phases.push(currentPhase);
      currentPhase = {
        agent: msg.agent!,
        startTime: msg.createdAt,
        endTime: msg.createdAt,
        tokens: msg.tokens || 0,
        messageCount: 1,
      };
    } else {
      currentPhase.endTime = msg.createdAt;
      currentPhase.tokens += msg.tokens || 0;
      currentPhase.messageCount++;
    }
  }
  if (currentPhase) phases.push(currentPhase);
  
  return phases;
}

/**
 * Aggregate session statistics from activity sessions and their messages
 * @param activitySessions - Array of activity sessions
 * @param allMessages - Map of sessionID to messages
 * @returns SessionStats with total tokens, cost, and model breakdown
 */
function aggregateSessionStats(
  activitySessions: ActivitySession[],
  allMessages: Map<string, MessageMeta[]>
): SessionStats {
  let totalTokens = 0;
  let totalCost = 0;
  let hasCost = false;
  const modelTokensMap = new Map<string, { modelID: string; providerID?: string; tokens: number }>();

  for (const session of activitySessions) {
    const messages = allMessages.get(session.id) || [];
    
    for (const msg of messages) {
      if (msg.tokens) {
        totalTokens += msg.tokens;
        
        const modelKey = `${msg.modelID || 'unknown'}:${msg.providerID || ''}`;
        const existing = modelTokensMap.get(modelKey);
        if (existing) {
          existing.tokens += msg.tokens;
        } else {
          modelTokensMap.set(modelKey, {
            modelID: msg.modelID || 'unknown',
            providerID: msg.providerID,
            tokens: msg.tokens,
          });
        }
      }
      
      if (msg.cost !== undefined) {
        totalCost += msg.cost;
        hasCost = true;
      }
    }
  }

  const modelBreakdown = Array.from(modelTokensMap.values())
    .sort((a, b) => b.tokens - a.tokens);

  return {
    totalTokens,
    totalCost: hasCost ? totalCost : undefined,
    modelBreakdown,
  };
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
    const lastAssistantFinished = isAssistantFinished(messages);
    const isSubagent = !!session.parentID;
    const status = getSessionStatus(messages, false, undefined, undefined, lastAssistantFinished, isSubagent);

    const lastMessage = messages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0];

    nodes.push({
      id: session.id,
      data: {
        title: session.title,
        agent: lastMessage?.agent,
        model: lastMessage?.modelID,
        isActive: status === "working" || status === "idle",
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
      const lastAssistantFinished = isAssistantFinished(messages);
      const status = getSessionStatus(messages, false, undefined, undefined, lastAssistantFinished);

      return {
        id: session.id,
        title: session.title,
        projectID: session.projectID,
        parentID: session.parentID,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        status,
        isActive: status === "working" || status === "idle",
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

app.get("/api/projects", async (c) => {
  const projectIDs = await listProjects();
  const allSessions = await listAllSessions();

  const projectsWithDetails = projectIDs.map((projectID) => {
    const projectSessions = allSessions.filter((s) => s.projectID === projectID);
    const directory = projectSessions[0]?.directory || "";

    const lastActivityAt =
      projectSessions.length > 0
        ? new Date(
            Math.max(...projectSessions.map((s) => s.updatedAt.getTime()))
          )
        : new Date(0);

    return {
      id: projectID,
      directory,
      sessionCount: projectSessions.length,
      lastActivityAt,
    };
  });

  projectsWithDetails.sort(
    (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
  );

  return c.json(projectsWithDetails);
});

async function getSessionHierarchy(
  rootSessionId: string,
  allSessions: SessionMetadata[]
): Promise<ActivitySession[]> {
  const result: ActivitySession[] = [];
  const processed = new Set<string>();

  const rootSession = allSessions.find((s) => s.id === rootSessionId);
  if (!rootSession) return result;

  const rootMessages = await listMessages(rootSessionId);
  const phases = detectAgentPhases(rootMessages);
  const childSessions = allSessions.filter((s) => s.parentID === rootSessionId);

  // Build messageAgent map for tool calls
  const messageAgent = new Map<string, string>();
  for (const msg of rootMessages) {
    if (msg.agent) {
      messageAgent.set(msg.id, msg.agent);
    }
  }

  if (phases.length <= 1) {
    const firstAssistantMsg = rootMessages
      .filter((m) => m.role === "assistant")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    
    const totalTokens = rootMessages
      .filter((m) => m.tokens !== undefined)
      .reduce((sum, m) => sum + (m.tokens || 0), 0);

    const parts = await getPartsForSession(rootSessionId);
    const toolState = getSessionToolState(parts);
    
    let workingChildCount = 0;
    for (const child of childSessions) {
      const childMessages = await listMessages(child.id);
      const childParts = await getPartsForSession(child.id);
      const childToolState = getSessionToolState(childParts);
      const childLastAssistantFinished = isAssistantFinished(childMessages);
      const childStatus = getSessionStatus(
        childMessages,
        childToolState.hasPendingToolCall,
        childToolState.lastToolCompletedAt || undefined,
        undefined,
        childLastAssistantFinished,
        true
      );
      if (childStatus === "working") {
        workingChildCount++;
      }
    }

    const rootLastAssistantFinished = isAssistantFinished(rootMessages);
    const status = getSessionStatus(
      rootMessages,
      toolState.hasPendingToolCall,
      toolState.lastToolCompletedAt || undefined,
      workingChildCount,
      rootLastAssistantFinished
    );

    let currentAction: string | null = null;
    if (status === "working") {
      const pendingParts = parts.filter(p => isPendingToolCall(p));
      if (pendingParts.length > 0) {
        currentAction = formatCurrentAction(pendingParts[0]);
      }
    }

    const toolCalls = await getToolCallsForSession(rootSessionId, messageAgent);

    result.push({
      id: rootSession.id,
      title: rootSession.title,
      agent: firstAssistantMsg?.agent || "unknown",
      modelID: firstAssistantMsg?.modelID,
      providerID: firstAssistantMsg?.providerID,
      parentID: rootSession.parentID,
      tokens: totalTokens > 0 ? totalTokens : undefined,
      status,
      currentAction,
      toolCalls,
      createdAt: rootSession.createdAt,
      updatedAt: rootSession.updatedAt,
    });
    processed.add(rootSessionId);

    for (const child of childSessions) {
      await processChildSession(child.id, rootSession.id, allSessions, result, processed);
    }
  } else {
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const nextPhaseStart = phases[i + 1]?.startTime || new Date(8640000000000000);
      const virtualId = `${rootSessionId}-phase-${i}-${phase.agent}`;

      const phaseMessages = rootMessages.filter(
        m => m.role === 'assistant' && m.agent === phase.agent &&
             m.createdAt >= phase.startTime && m.createdAt <= phase.endTime
      );
      const firstPhaseMsg = phaseMessages[0];

      const phaseChildren = childSessions.filter(child =>
        child.createdAt >= phase.startTime && child.createdAt < nextPhaseStart
      );

      let workingChildCount = 0;
      for (const child of phaseChildren) {
        const childMessages = await listMessages(child.id);
        const childParts = await getPartsForSession(child.id);
        const childToolState = getSessionToolState(childParts);
        const childLastAssistantFinished = isAssistantFinished(childMessages);
        const childStatus = getSessionStatus(
          childMessages,
          childToolState.hasPendingToolCall,
          childToolState.lastToolCompletedAt || undefined,
          undefined,
          childLastAssistantFinished,
          true
        );
        if (childStatus === "working") {
          workingChildCount++;
        }
      }

      const phaseLastAssistantFinished = isAssistantFinished(phaseMessages);
      const isLastPhase = i === phases.length - 1;
      const status = workingChildCount > 0 
        ? "waiting" 
        : (phaseLastAssistantFinished 
            ? (isLastPhase ? "waiting" : "completed") 
            : getStatusFromTimestamp(phase.endTime));

      const allToolCalls = await getToolCallsForSession(rootSessionId, messageAgent);
      const toolCalls = allToolCalls.filter(tc => tc.agentName === phase.agent);

      result.push({
        id: virtualId,
        title: rootSession.title,
        agent: phase.agent,
        modelID: firstPhaseMsg?.modelID,
        providerID: firstPhaseMsg?.providerID,
        parentID: undefined,
        tokens: phase.tokens > 0 ? phase.tokens : undefined,
        status,
        currentAction: null,
        toolCalls,
        createdAt: phase.startTime,
        updatedAt: phase.endTime,
      });

      for (const child of phaseChildren) {
        await processChildSession(child.id, virtualId, allSessions, result, processed);
      }
    }
  }

  return result;
}

async function processChildSession(
  sessionId: string,
  parentId: string,
  allSessions: SessionMetadata[],
  result: ActivitySession[],
  processed: Set<string>
): Promise<void> {
  if (processed.has(sessionId)) return;
  processed.add(sessionId);

  const session = allSessions.find((s) => s.id === sessionId);
  if (!session) return;

  const messages = await listMessages(sessionId);
  const firstAssistantMsg = messages
    .filter((m) => m.role === "assistant")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  const totalTokens = messages
    .filter((m) => m.tokens !== undefined)
    .reduce((sum, m) => sum + (m.tokens || 0), 0);

  const messageAgent = new Map<string, string>();
  for (const msg of messages) {
    if (msg.agent) {
      messageAgent.set(msg.id, msg.agent);
    }
  }

  const parts = await getPartsForSession(sessionId);
  const toolState = getSessionToolState(parts);
  
  const childSessions = allSessions.filter((s) => s.parentID === sessionId);
  let workingChildCount = 0;
  
  for (const child of childSessions) {
    const childMessages = await listMessages(child.id);
    const childParts = await getPartsForSession(child.id);
    const childToolState = getSessionToolState(childParts);
    const childLastAssistantFinished = isAssistantFinished(childMessages);
    const childStatus = getSessionStatus(
      childMessages,
      childToolState.hasPendingToolCall,
      childToolState.lastToolCompletedAt || undefined,
      undefined,
      childLastAssistantFinished,
      true
    );
    if (childStatus === "working") {
      workingChildCount++;
    }
  }

  const lastAssistantFinished = isAssistantFinished(messages);
  const status = getSessionStatus(
    messages,
    toolState.hasPendingToolCall,
    toolState.lastToolCompletedAt || undefined,
    workingChildCount,
    lastAssistantFinished,
    true
  );

  let currentAction: string | null = null;
  if (status === "working") {
    const pendingParts = parts.filter(p => isPendingToolCall(p));
    if (pendingParts.length > 0) {
      currentAction = formatCurrentAction(pendingParts[0]);
    }
  }

  const toolCalls = await getToolCallsForSession(sessionId, messageAgent);

  result.push({
    id: session.id,
    title: session.title,
    agent: firstAssistantMsg?.agent || "unknown",
    modelID: firstAssistantMsg?.modelID,
    providerID: firstAssistantMsg?.providerID,
    parentID: parentId,
    tokens: totalTokens > 0 ? totalTokens : undefined,
    status,
    currentAction,
    toolCalls,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });

  for (const child of childSessions) {
    await processChildSession(child.id, session.id, allSessions, result, processed);
  }
}

interface PollResponse {
  sessions: SessionMetadata[];
  activeSession: SessionMetadata | null;
  planProgress: PlanProgress | null;
  messages: MessageMeta[];
  activitySessions: ActivitySession[];
  sessionStats?: SessionStats;
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

    const sessionsWithAgent = await Promise.all(
      rootSessions.map(async (session) => {
        const firstAssistantMsg = await getFirstAssistantMessage(session.id);
        const messages = await listMessages(session.id);
        const parts = await getPartsForSession(session.id);
        const toolState = getSessionToolState(parts);
        const lastAssistantFinished = isAssistantFinished(messages);
        
        const status = getSessionStatus(
          messages,
          toolState.hasPendingToolCall,
          toolState.lastToolCompletedAt || undefined,
          undefined,
          lastAssistantFinished
        );
        
        let currentAction: string | null = null;
        if (status === "working") {
          const pendingParts = parts.filter(p => isPendingToolCall(p));
          if (pendingParts.length > 0) {
            currentAction = formatCurrentAction(pendingParts[0]);
          }
        }
        
        return {
          ...session,
          agent: firstAssistantMsg?.agent || null,
          modelID: firstAssistantMsg?.modelID || null,
          providerID: firstAssistantMsg?.providerID || null,
          status,
          currentAction,
        };
      })
    );

    let activeSession: SessionMetadata | null = null;
    for (const session of rootSessions) {
      const messages = await listMessages(session.id);
      const parts = await getPartsForSession(session.id);
      const toolState = getSessionToolState(parts);
      const lastAssistantFinished = isAssistantFinished(messages);
      
      const status = getSessionStatus(
        messages,
        toolState.hasPendingToolCall,
        toolState.lastToolCompletedAt || undefined,
        undefined,
        lastAssistantFinished
      );

      if (status === "working" || status === "idle") {
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
    let sessionStats: SessionStats | undefined = undefined;
    const sessionId = c.req.query('sessionId');
    const targetSessionId = sessionId || activeSession?.id;
    if (targetSessionId) {
      const fetchedMessages = await listMessages(targetSessionId);
      const sortedMessages = fetchedMessages.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      messages = sortedMessages.slice(0, 100);
      
      activitySessions = await getSessionHierarchy(targetSessionId, allSessions);
      
      const allMessagesMap = new Map<string, MessageMeta[]>();
      for (const session of activitySessions) {
        const sessionMessages = await listMessages(session.id);
        allMessagesMap.set(session.id, sessionMessages);
      }
      
      sessionStats = aggregateSessionStats(activitySessions, allMessagesMap);
    }

    const pollData: PollResponse = {
      sessions: sessionsWithAgent,
      activeSession,
      planProgress,
      messages,
      activitySessions,
      sessionStats,
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
