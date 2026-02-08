import type { Hono } from "hono";
import { z } from "zod";
import { 
  generateETag, 
  fetchPollData, 
  getPollCache, 
  setPollCache, 
  getPollCacheEpoch,
  getPollInProgress, 
  setPollInProgress,
  getPollCacheTTL
} from "../services/pollService";
import { sessionIdSchema, validateWithResponse } from "../validation";

const projectIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, "Invalid project ID format");

export function registerPollRoute(app: Hono) {
  app.get("/api/poll", async (c) => {
    const clientETag = c.req.header("If-None-Match");
    const rawSessionId = c.req.query('sessionId');
    const rawProjectId = c.req.query("projectId");
    
    let sessionId: string | undefined;
    let projectId: string | undefined;

    if (rawSessionId) {
      const validation = validateWithResponse(sessionIdSchema, rawSessionId, c);
      if (!validation.success) return validation.response;
      sessionId = validation.value;
    }

    if (rawProjectId) {
      const validation = validateWithResponse(projectIdSchema, rawProjectId, c);
      if (!validation.success) return validation.response;
      projectId = validation.value;
    }
    
    const POLL_CACHE_TTL = getPollCacheTTL();
    const scopeProjectId = sessionId ? undefined : projectId;
    
    const cached = getPollCache(scopeProjectId);
    if (!sessionId && cached && Date.now() - cached.timestamp < POLL_CACHE_TTL) {
      if (clientETag === cached.etag) {
        return new Response(null, { status: 304, headers: { ETag: cached.etag } });
      }
      c.header("ETag", cached.etag);
      return c.json(cached.data);
    }
    
    const inProgress = getPollInProgress(scopeProjectId);
    if (!sessionId && inProgress) {
      try {
        const data = await inProgress;
        const etag = generateETag(data);
        if (clientETag === etag) {
          return new Response(null, { status: 304, headers: { ETag: etag } });
        }
        c.header("ETag", etag);
        return c.json(data);
      } catch {
        setPollInProgress(null, scopeProjectId);
      }
    }
    
    let pollData: Awaited<ReturnType<typeof fetchPollData>>;
    if (!sessionId) {
      const cacheEpochAtStart = getPollCacheEpoch();
      const promise = fetchPollData(undefined, projectId);
      setPollInProgress(promise, scopeProjectId);
      try {
        pollData = await promise;
        const etag = generateETag(pollData);
        if (cacheEpochAtStart === getPollCacheEpoch()) {
          setPollCache({ data: pollData, etag, timestamp: Date.now() }, scopeProjectId);
        }
      } finally {
        setPollInProgress(null, scopeProjectId);
      }
    } else {
      pollData = await fetchPollData(sessionId, projectId);
    }
    
    const etag = generateETag(pollData);
    if (clientETag === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    c.header("ETag", etag);
    return c.json(pollData);
  });
}
