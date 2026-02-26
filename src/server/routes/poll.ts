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
  getPollCacheTTL,
} from "../services/pollService";

const projectIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, "Invalid project ID format");

export function registerPollRoute(app: Hono) {
  app.get("/api/poll", async (c) => {
    const clientETag = c.req.header("If-None-Match");
    const rawProjectId = c.req.query("projectId");

    let projectId: string | undefined;

    if (rawProjectId) {
      const result = projectIdSchema.safeParse(rawProjectId);
      if (!result.success) {
        return c.json({ error: "INVALID_PROJECT_ID", message: "Invalid project ID format" }, 400);
      }
      projectId = result.data;
    }

    const POLL_CACHE_TTL = getPollCacheTTL();

    const cached = getPollCache(projectId);
    if (cached && Date.now() - cached.timestamp < POLL_CACHE_TTL) {
      if (clientETag === cached.etag) {
        return new Response(null, { status: 304, headers: { ETag: cached.etag } });
      }
      c.header("ETag", cached.etag);
      return c.json(cached.data);
    }

    const inProgress = getPollInProgress(projectId);
    if (inProgress) {
      try {
        const data = await inProgress;
        const etag = generateETag(data);
        if (clientETag === etag) {
          return new Response(null, { status: 304, headers: { ETag: etag } });
        }
        c.header("ETag", etag);
        return c.json(data);
      } catch {
        setPollInProgress(null, projectId);
      }
    }

    const cacheEpochAtStart = getPollCacheEpoch();
    const promise = fetchPollData(projectId);
    setPollInProgress(promise, projectId);

    let pollData: Awaited<ReturnType<typeof fetchPollData>>;
    try {
      pollData = await promise;
      const etag = generateETag(pollData);
      if (cacheEpochAtStart === getPollCacheEpoch()) {
        setPollCache({ data: pollData, etag, timestamp: Date.now() }, projectId);
      }
    } finally {
      setPollInProgress(null, projectId);
    }

    const etag = generateETag(pollData);
    if (clientETag === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    c.header("ETag", etag);
    return c.json(pollData);
  });
}
