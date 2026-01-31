import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";

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

// Session endpoints (stubs)
app.get("/api/sessions", (c) => {
  return c.json([]);
});

app.get("/api/sessions/:id", (c) => {
  return c.json(null);
});

app.get("/api/sessions/:id/messages", (c) => {
  return c.json([]);
});

app.get("/api/sessions/:id/tree", (c) => {
  return c.json({});
});

// Part file endpoint (stub)
app.get("/api/parts/:id", (c) => {
  return c.json(null);
});

// Plan progress endpoint (stub)
app.get("/api/plan", (c) => {
  return c.json(null);
});

// Projects endpoint (stub)
app.get("/api/projects", (c) => {
  return c.json([]);
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
