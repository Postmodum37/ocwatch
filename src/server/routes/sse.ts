import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Watcher } from "../watcher";
import { getPollCache } from "../services/pollService";

let globalWatcher: Watcher | null = null;
const activeAbortControllers = new Set<AbortController>();

export function getGlobalWatcher(): Watcher {
  if (!globalWatcher) {
    globalWatcher = new Watcher();
    globalWatcher.start();
  }
  return globalWatcher;
}

export function closeAllSSEConnections(): void {
  for (const controller of activeAbortControllers) {
    controller.abort();
  }
  activeAbortControllers.clear();
}

export function getActiveConnectionCount(): number {
  return activeAbortControllers.size;
}

export function registerSSERoute(app: Hono) {
  app.get("/api/sse", async (c) => {
    return streamSSE(c, async (stream) => {
      const watcher = getGlobalWatcher();
      const abortController = new AbortController();
      activeAbortControllers.add(abortController);

      abortController.signal.addEventListener("abort", () => {
        stream.abort();
      });
      
      await stream.writeSSE({
        data: JSON.stringify({ connected: true, timestamp: Date.now() }),
        event: "connected",
      });

      const heartbeatInterval = setInterval(async () => {
        try {
          await stream.writeSSE({
            data: JSON.stringify({ timestamp: Date.now() }),
            event: "heartbeat",
          });
        } catch {
          // Ignore errors when stream is closed
        }
      }, 30000);

      const handleChange = async (data: { eventType: string; filename: string }) => {
        try {
          let eventType = "session-update";
          if (data.filename.includes("message")) {
            eventType = "message-update";
          } else if (data.filename.includes("part")) {
            eventType = "part-update";
          } else if (data.filename.includes("boulder")) {
            eventType = "plan-update";
          }

          const cached = getPollCache();
          await stream.writeSSE({
            data: JSON.stringify({
              filename: data.filename,
              eventType: data.eventType,
              timestamp: Date.now(),
              pollData: cached?.data ?? null,
            }),
            event: eventType,
          });
        } catch {
          // Ignore errors when stream is closed
        }
      };

      watcher.on("change", handleChange);

      stream.onAbort(() => {
        clearInterval(heartbeatInterval);
        watcher.removeListener("change", handleChange);
        activeAbortControllers.delete(abortController);
      });

      await new Promise(() => {});
    });
  });
}
