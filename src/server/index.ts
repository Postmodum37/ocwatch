import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { registerRoutes } from "./routes";
import { parseArgs, printHelp, openBrowser } from "./cli";

const app = new Hono();

app.use("*", errorHandler);

app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:50234"],
    credentials: true,
  })
);

registerRoutes(app);

app.use("/*", serveStatic({ root: "./src/client/dist" }));

app.notFound(notFoundHandler);

export { app };

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
