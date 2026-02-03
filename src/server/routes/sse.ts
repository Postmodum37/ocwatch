import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Watcher } from "../watcher";

let globalWatcher: Watcher | null = null;

export function getGlobalWatcher(): Watcher {
  if (!globalWatcher) {
    globalWatcher = new Watcher();
    globalWatcher.start();
  }
  return globalWatcher;
}

export function registerSSERoute(app: Hono) {
  app.get("/api/sse", async (c) => {
    return streamSSE(c, async (stream) => {
      const watcher = getGlobalWatcher();
      
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
          } else if (data.filename.includes("boulder")) {
            eventType = "plan-update";
          }

          await stream.writeSSE({
            data: JSON.stringify({
              filename: data.filename,
              eventType: data.eventType,
              timestamp: Date.now(),
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
      });

      await new Promise(() => {});
    });
  });
}
