import { createHash } from "node:crypto";
import type { PollResponse, SessionMetadata, MessageMeta, PlanProgress, ActivitySession } from "../../shared/types";
import { listAllSessions, checkStorageExists } from "../storage/sessionParser";
import { listMessages, getFirstAssistantMessage } from "../storage/messageParser";
import { parseBoulder, calculatePlanProgress } from "../storage/boulderParser";
import { getPartsForSession, getSessionToolState, isPendingToolCall, formatCurrentAction } from "../storage/partParser";
import { getSessionStatus } from "../utils/sessionStatus";
import { isAssistantFinished, getSessionHierarchy } from "./sessionService";
import { aggregateSessionStats } from "./statsService";

export function generateETag(data: PollResponse): string {
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

let pollCache: { data: PollResponse; etag: string; timestamp: number } | null = null;
let pollInProgress: Promise<PollResponse> | null = null;
const POLL_CACHE_TTL = 2000;

export function getPollCache() {
  return pollCache;
}

export function setPollCache(cache: { data: PollResponse; etag: string; timestamp: number } | null) {
  pollCache = cache;
}

export function getPollInProgress() {
  return pollInProgress;
}

export function setPollInProgress(promise: Promise<PollResponse> | null) {
  pollInProgress = promise;
}

export function getPollCacheTTL() {
  return POLL_CACHE_TTL;
}

export async function fetchPollData(sessionId?: string): Promise<PollResponse> {
  const storageExists = await checkStorageExists();
  if (!storageExists) {
    return {
      sessions: [],
      activeSession: null,
      planProgress: null,
      messages: [],
      activitySessions: [],
      lastUpdate: Date.now(),
    };
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

   let planProgress: PlanProgress | null = null;
   try {
     const cwd = process.cwd();
     const boulder = await parseBoulder(cwd);
     if (boulder?.activePlan) {
       planProgress = await calculatePlanProgress(boulder.activePlan);
     }
   } catch {
   }

   let messages: MessageMeta[] = [];
   let activitySessions: ActivitySession[] = [];
   let sessionStats = undefined;
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

   return {
     sessions: sessionsWithAgent,
     activeSession,
     planProgress,
     messages,
     activitySessions,
     sessionStats,
     lastUpdate: now,
   };
}
