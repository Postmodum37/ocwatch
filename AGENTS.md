# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-01
**Stack:** TypeScript + Bun + React
**Branch:** main

## OVERVIEW

Real-time web dashboard monitoring OpenCode agent activity. Reads from `~/.local/share/opencode/storage/`, displays sessions, agents, tool calls, and plan progress. Built with TypeScript, Bun, Hono (backend), and React + Vite (frontend).

## STRUCTURE

```
ocwatch/
├── src/
│   ├── server/              # Bun + Hono backend
│   │   ├── index.ts         # Server entry point, routes, static serving
│   │   ├── storage/         # OpenCode storage parsers (session, message, part, boulder)
│   │   ├── watcher/         # fs.watch + dirty-flag cache
│   │   ├── cache/           # In-memory cache with TTL
│   │   └── __tests__/       # Server unit tests
│   ├── client/              # React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/  # UI components (SessionList, AgentTree, ToolCalls, PlanProgress)
│   │   │   ├── hooks/       # React hooks (usePolling)
│   │   │   ├── store/       # AppContext (React Context API)
│   │   │   └── styles/      # Tailwind CSS
│   │   └── __tests__/       # Component tests (Vitest)
│   ├── shared/              # Shared types and utilities
│   │   ├── types/           # TypeScript types (SessionMetadata, MessageMeta, etc.)
│   │   └── utils/           # RingBuffer, utilities
│   └── __tests__/           # Integration tests
├── package.json             # Bun project config
└── tsconfig.json            # TypeScript config
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new API endpoint | `src/server/index.ts` | Add route handler, use storage parsers |
| New UI component | `src/client/src/components/` | Create `.tsx` file, use Tailwind classes |
| Track new state | `src/client/src/store/AppContext.tsx` | Add to context state, create setter |
| Session filtering | `src/server/storage/sessionParser.ts` | `filterSessionsByTime()`, `filterActiveSessions()` |
| Plan progress | `src/server/storage/boulderParser.ts` | `parseBoulder()` reads `.sisyphus/boulder.json` |
| Add new type | `src/shared/types/index.ts` | Export from shared types |
| Polling logic | `src/client/src/hooks/usePolling.ts` | ETag caching, 2s interval |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `app` | Hono | src/server/index.ts | Main server app with routes |
| `usePolling` | hook | src/client/src/hooks/usePolling.ts | Polls `/api/poll` every 2s with ETag |
| `AppProvider` | component | src/client/src/store/AppContext.tsx | Global state provider (sessions, projects, plan) |
| `SessionList` | component | src/client/src/components/SessionList.tsx | Sidebar with session list + project dropdown |
| `AgentTree` | component | src/client/src/components/AgentTree.tsx | React Flow tree visualization |
| `ToolCalls` | component | src/client/src/components/ToolCalls.tsx | Collapsible tool calls panel |
| `PlanProgress` | component | src/client/src/components/PlanProgress.tsx | Plan progress display |
| `parseSession` | function | src/server/storage/sessionParser.ts | Parse session JSON from storage |
| `parseBoulder` | function | src/server/storage/boulderParser.ts | Parse boulder.json for plan progress |
| `RingBuffer` | class | src/shared/utils/RingBuffer.ts | Fixed-size circular buffer (1000 max) |
| `createWatcher` | function | src/server/watcher/index.ts | fs.watch with dirty-flag pattern |

## CONVENTIONS

- **TypeScript**: Strict mode, `verbatimModuleSyntax: true`
- **Path aliases**: `@server/`, `@client/`, `@shared/` configured in tsconfig
- **Testing**: 
  - Server: `bun test` (Bun's built-in runner)
  - Client: `bun run test` (Vitest with jsdom)
  - Integration: `bun test src/__tests__/integration.test.ts`
- **Styling**: Tailwind CSS with dark theme (GitHub/Linear inspired)
- **State management**: React Context API (no Redux/Zustand)
- **API**: RESTful with ETag caching, 2s polling interval
- **File watching**: `fs.watch()` with 100ms debounce, dirty-flag cache
- **XDG**: Respects `XDG_DATA_HOME`, defaults to `~/.local/share/opencode`

## ANTI-PATTERNS (THIS PROJECT)

**CRITICAL GUARDRAILS**:

| Forbidden | Reason |
|-----------|--------|
| Token/cost estimation | Out of scope |
| Filtering/search UI | Complexity creep |
| Historical analytics | Not a metrics tool |
| Export (CSV/JSON) | Read-only monitor |
| Remote monitoring | Local only |
| Theming/customization | Single dark theme |
| Config persistence | Stateless (URL params only) |
| Modify OpenCode files | READ-ONLY |
| Control agents | Monitor only |
| Poll < 2s | Server load |
| > 1000 entries | Memory cap (RingBuffer enforces) |
| Windows/Linux support | macOS only for v1 |
| WebSocket | Use HTTP polling |
| SSR | SPA only |
| Bulk-read part/ files | Lazy load on demand (25k+ files) |

## COMMANDS

```bash
# Development (hot reload for both server + client)
bun run dev                           # Runs server (--watch) + Vite dev server concurrently
bun run dev:server                    # Server only with hot reload (port 50234)
bun run dev:client                    # Vite only with HMR (port 5173)

# Production
bun run build                         # Build client for production
bun run start                         # Start production server (serves built client)

# Tests
bun test                              # Server tests
cd src/client && bun run test        # Client tests (Vitest)
bun test src/__tests__/integration.test.ts  # Integration tests

# Type checking
bun run tsc -b

# Linting
cd src/client && bun run lint
```

## NOTES

- **Dev workflow**: `bun run dev` starts both server (with Bun --watch for hot reload) and Vite dev server (with HMR). Open http://localhost:5173 - API calls are proxied to :50234
- **Storage format**: OpenCode stores sessions in `~/.local/share/opencode/storage/session/{projectID}/{sessionID}.json`
- **Message storage**: `storage/message/{sessionID}/{messageID}.json`
- **Part files**: `storage/part/{sessionID}/{partID}.json` (lazy loaded)
- **Plan tracking**: Reads `.sisyphus/boulder.json` from `--project` or cwd
- **Polling**: Client polls `/api/poll` every 2 seconds, server uses ETag for 304 responses
- **Active session**: Last message < 5 minutes ago
- **Session hierarchy**: Built from `session.parentID` field
- **Dark theme colors**:
  - Background: `#0d1117`
  - Surface: `#161b22`
  - Accent: `#58a6ff`
  - Text: `#c9d1d9`

## API ENDPOINTS

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check (returns `{status: "ok"}`) |
| `/api/sessions` | GET | List sessions (last 24h or 20 max) |
| `/api/sessions/:id` | GET | Session details |
| `/api/sessions/:id/messages` | GET | Session messages (last 100) |
| `/api/sessions/:id/tree` | GET | Agent hierarchy tree (React Flow format) |
| `/api/parts/:id` | GET | Single part file (lazy load) |
| `/api/plan` | GET | Plan progress from boulder.json |
| `/api/projects` | GET | List available projects |
| `/api/poll` | GET | Polling endpoint (sessions + plan + active session) |
| `/` | GET | Serve static frontend |

## CLI FLAGS

```bash
bun run start [options]

Options:
  --port <number>      Override port (default: 50234)
  --no-browser         Skip auto-open browser
  --project <path>     Set default project filter
  --help               Show help
```
