# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-08
**Commit:** 68cd755
**Branch:** main

## OVERVIEW

Real-time web dashboard monitoring OpenCode agent activity. Reads from `~/.local/share/opencode/storage/`, displays sessions, agent hierarchies, tool calls, and plan progress. Built with TypeScript, Bun, Hono (backend), and React + Vite (frontend). Published to npm as `ocwatch`.

## STRUCTURE

```
ocwatch/
├── src/
│   ├── server/              # Bun + Hono backend (see src/server/AGENTS.md)
│   │   ├── index.ts         # Server bootstrap, CORS, static serving, shutdown
│   │   ├── cli.ts           # --port, --project, --no-browser flag parsing
│   │   ├── watcher.ts       # EventEmitter fs.watch on 5 directories, 100ms debounce
│   │   ├── validation.ts    # Zod schemas for request params
│   │   ├── routes/          # 7 route modules (health, sessions, parts, poll, sse, plan, projects)
│   │   ├── services/        # Business logic (pollService, sessionService, statsService)
│   │   ├── storage/         # OpenCode file parsers (session, message, part, boulder)
│   │   ├── utils/           # sessionStatus, projectResolver
│   │   └── middleware/       # Global error handler
│   ├── client/              # React + Vite SPA (see src/client/AGENTS.md)
│   │   ├── src/
│   │   │   ├── components/  # 14 components + 5 sidebar widgets
│   │   │   ├── hooks/       # useSSE, usePolling, useNotifications, useKeyboardShortcuts
│   │   │   ├── store/       # AppContext (React Context API)
│   │   │   ├── utils/       # agentColors, formatters
│   │   │   └── styles/      # Tailwind CSS + custom animations
│   │   └── e2e/             # Playwright smoke + SSE tests
│   ├── shared/              # Cross-boundary types and utilities (see src/shared/AGENTS.md)
│   │   ├── types/           # 30+ interfaces — the API contract
│   │   ├── utils/           # RingBuffer, burstGrouping, activityUtils, formatTime
│   │   └── constants.ts     # Shared constants (ports, limits, TTLs)
│   └── __tests__/           # Integration tests
├── package.json             # Bun project config, npm publishing
└── tsconfig.json            # Root TS config with @server/@client/@shared aliases
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add API endpoint | `src/server/routes/` | Create file, register in `routes/index.ts` |
| New UI component | `src/client/src/components/` | `.tsx`, Tailwind classes, dark theme only |
| Track new state | `src/client/src/store/AppContext.tsx` | Add to `AppContextValue` interface |
| New storage source | `src/server/storage/` | New parser → wire into `pollService.fetchPollData()` |
| Add shared type | `src/shared/types/index.ts` | Types only — no logic in this file |
| Session status logic | `src/server/utils/sessionStatus.ts` | Time-based thresholds (30s/5min) |
| Activity display text | `src/server/storage/partParser.ts` | `formatCurrentAction()`, `TOOL_DISPLAY_NAMES` |
| Polling/SSE tuning | `src/client/src/hooks/useSSE.ts` | SSE with polling fallback, ETag caching |
| Plan tracking | `src/server/storage/boulderParser.ts` | Parses `.sisyphus/boulder.json` + markdown |
| Agent hierarchy | `src/server/services/sessionService.ts` | `getSessionHierarchy()` builds tree |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `app` | Hono | server/index.ts | Server app, CORS, static serving |
| `registerRoutes` | fn | server/routes/index.ts | Wires all 7 route modules |
| `fetchPollData` | fn | server/services/pollService.ts | Aggregates sessions+messages+parts+plan → `PollResponse` |
| `getSessionHierarchy` | fn | server/services/sessionService.ts | Builds parent/child tree with agent phase detection |
| `Watcher` | class | server/watcher.ts | EventEmitter wrapping `fs.watch` on 5 dirs |
| `parsePart` | fn | server/storage/partParser.ts | Parses tool call JSON → `PartMeta` |
| `getSessionActivityState` | fn | server/storage/partParser.ts | Derives pending/completed/reasoning state |
| `AppProvider` | component | client/src/store/AppContext.tsx | Global state (sessions, plan, projects, UI) |
| `useSSE` | hook | client/src/hooks/useSSE.ts | SSE → polling fallback, ETag 304, reconnect backoff |
| `LiveActivity` | component | client/src/components/LiveActivity.tsx | Main panel: real-time session tree |
| `ActivityStream` | component | client/src/components/ActivityStream.tsx | Bottom panel: burst/milestone timeline |
| `SessionList` | component | client/src/components/SessionList.tsx | Sidebar: project dropdown + session list |
| `synthesizeActivityItems` | fn | shared/utils/activityUtils.ts | Sessions → ActivityItems (spawns+tools+completions) |
| `groupIntoBursts` | fn | shared/utils/burstGrouping.ts | Groups tool calls by agent into burst entries |
| `RingBuffer` | class | shared/utils/RingBuffer.ts | Fixed-size circular buffer (1000 max) |

## CONVENTIONS

- **TypeScript**: Strict mode, `verbatimModuleSyntax: true` (client), path aliases `@server/`, `@client/`, `@shared/`
- **Testing**: Server → `bun test` (Bun native), Client → Vitest + jsdom, E2E → Playwright
- **Styling**: Tailwind CSS, single dark theme (`#0d1117` bg, `#58a6ff` accent), custom animations in `animations.css`
- **State**: React Context API only — no Redux/Zustand
- **API**: ETag-cached polling (2s interval) + SSE with polling fallback. Promise coalescing deduplicates concurrent requests
- **File watching**: `fs.watch()` recursive on 5 dirs, 100ms debounce, emits single `change` event → invalidates poll cache
- **Error handling**: Corrupted JSON → `console.warn` + `null` (never crashes). API errors → Zod validation + error middleware
- **XDG**: Respects `XDG_DATA_HOME`, defaults to `~/.local/share/opencode`
- **Publishing**: CI-only via `release: published` GitHub Action. Never `bun publish` manually

## ANTI-PATTERNS (THIS PROJECT)

| Forbidden | Reason |
|-----------|--------|
| Token/cost estimation | Out of scope |
| Filtering/search UI | Complexity creep |
| Historical analytics | Not a metrics tool |
| Export (CSV/JSON) | Read-only monitor |
| Remote monitoring | Local only |
| Theming/customization | Single dark theme |
| Config persistence | Stateless (URL params only) |
| Modify OpenCode files | **READ-ONLY** |
| Control agents | Monitor only |
| Poll < 2s | Server load |
| > 1000 entries | Memory cap (RingBuffer) |
| Windows/Linux support | macOS only for v1 |
| WebSocket | Use HTTP polling + SSE |
| SSR | SPA only |
| Bulk-read part/ files | Lazy load on demand (25k+ files) |
| Manual `bun publish` | CI handles it |
| `npm publish` | Breaks (nested `.gitignore`) |

## AVAILABLE MCP TOOLS

When working on this project, use external documentation tools for library/API questions:

| Tool | Use For |
|------|---------|
| **Context7** | Up-to-date library docs and code examples (Hono, Zod, Vite, React, Tailwind) |
| **Tavily** | Web search, URL extraction, deep research for best practices |
| **Ref** | Search public/private documentation, read specific doc pages |

Don't default to just codebase grep — reach for these when dealing with libraries or patterns outside the project.

## COMMANDS

```bash
# Development
bun run dev                           # Server (--watch) + Vite concurrently
bun run dev:server                    # Server only (port 50234)
bun run dev:client                    # Vite only (port 5173, proxies /api → :50234)

# Production
bun run build                         # Build client
bun run start                         # Production server (serves built client)

# Tests
bun test                              # Server + shared + integration tests
cd src/client && bun run test         # Client tests (Vitest)
cd src/client && bun run test:e2e     # Playwright E2E

# Type checking / Linting
bun run tsc -b
cd src/client && bun run lint
```

## NOTES

- **Data flow**: Watcher detects fs change → invalidates poll cache → `/api/poll` or SSE pushes → client updates via `AppContext`
- **Storage paths**: `~/.local/share/opencode/storage/{session,message,part}/{projectID|sessionID}/*.json`
- **Part files**: Two layouts (flat `part/{id}.json` or nested `part/{messageID}/{id}.json`) — parser handles both
- **Session status**: Computed on-the-fly from message timestamps + pending tool count (not stored)
- **Multi-agent phases**: `sessionService` creates virtual session IDs (`{id}-phase-{i}-{agent}`) for agent handoffs
- **Complexity hotspots**: `partParser.ts` (532 lines, 12 exports), `sessionService.ts` (476 lines, tree building)
- **Validation**: Zod schemas for IDs (`ses_[a-zA-Z0-9]+`, `[a-zA-Z0-9_-]+`)
- **No CI tests**: Only publish workflow — local checks before release

## API ENDPOINTS

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check + `defaultProjectId` |
| `/api/sessions` | GET | Sessions (last 24h, max 20) |
| `/api/sessions/:id` | GET | Session details |
| `/api/sessions/:id/messages` | GET | Messages (last 100, desc) |
| `/api/sessions/:id/tree` | GET | Agent tree (React Flow format) |
| `/api/parts/:id` | GET | Single part (lazy load) |
| `/api/plan` | GET | Plan progress from boulder.json |
| `/api/projects` | GET | Available projects |
| `/api/poll` | GET | Main endpoint: sessions + plan + messages + activity + stats (ETag cached) |
| `/api/sse` | GET | Server-Sent Events (30s heartbeat, watcher-triggered) |

## RELEASING

```bash
npm version patch   # bumps version, creates commit + tag
git push && git push --tags
gh release create v0.X.X --generate-notes   # triggers CI → npm publish
```

- `.github/workflows/publish.yml` syncs version from git tag, builds, publishes via `bun publish --tolerate-republish`
- `NPM_TOKEN` secret has 90-day expiration — renew when needed

## CLI FLAGS

```bash
bunx ocwatch [options]

Options:
  --port <number>      Override port (default: 50234)
  --no-browser         Skip auto-open browser
  --project <path>     Set default project filter
  --help               Show help
```
