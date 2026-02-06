import type { Hono } from "hono";
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

export function registerPollRoute(app: Hono) {
  app.get("/api/poll", async (c) => {
    const clientETag = c.req.header("If-None-Match");
    const rawSessionId = c.req.query('sessionId');
    
    let sessionId: string | undefined;
    if (rawSessionId) {
      const validation = validateWithResponse(sessionIdSchema, rawSessionId, c);
      if (!validation.success) return validation.response;
      sessionId = validation.value;
    }
    
    const pollCache = getPollCache();
    const POLL_CACHE_TTL = getPollCacheTTL();
    
    if (!sessionId && pollCache && Date.now() - pollCache.timestamp < POLL_CACHE_TTL) {
      if (clientETag === pollCache.etag) {
        return new Response(null, { status: 304, headers: { ETag: pollCache.etag } });
      }
      c.header("ETag", pollCache.etag);
      return c.json(pollCache.data);
    }
    
    const pollInProgress = getPollInProgress();
    if (!sessionId && pollInProgress) {
      try {
        const data = await pollInProgress;
        const etag = generateETag(data);
        if (clientETag === etag) {
          return new Response(null, { status: 304, headers: { ETag: etag } });
        }
        c.header("ETag", etag);
        return c.json(data);
      } catch {
        setPollInProgress(null);
      }
    }
    
    let pollData: Awaited<ReturnType<typeof fetchPollData>>;
    if (!sessionId) {
      const cacheEpochAtStart = getPollCacheEpoch();
      const promise = fetchPollData();
      setPollInProgress(promise);
      try {
        pollData = await promise;
        const etag = generateETag(pollData);
        if (cacheEpochAtStart === getPollCacheEpoch()) {
          setPollCache({ data: pollData, etag, timestamp: Date.now() });
        }
      } finally {
        setPollInProgress(null);
      }
    } else {
      pollData = await fetchPollData(sessionId);
    }
    
    const etag = generateETag(pollData);
    if (clientETag === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    c.header("ETag", etag);
    return c.json(pollData);
  });
}
