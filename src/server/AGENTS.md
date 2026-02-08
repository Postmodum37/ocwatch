# SERVER — Bun + Hono Backend

## OVERVIEW

HTTP API server reading OpenCode storage files, computing session hierarchies and activity states, serving data via ETag-cached polling + SSE push.

## STRUCTURE

```
server/
├── index.ts              # Hono app, CORS, static serving, graceful shutdown
├── cli.ts                # Flag parsing (--port, --project, --no-browser)
├── watcher.ts            # EventEmitter fs.watch on 5 dirs, 100ms debounce
├── validation.ts         # Zod schemas: ses_[a-zA-Z0-9]+, [a-zA-Z0-9_-]+
├── routes/
│   ├── index.ts          # registerRoutes() wires all 7 modules
│   ├── poll.ts           # /api/poll — ETag 304, cache epoch check, dedup in-flight
│   ├── sse.ts            # /api/sse — watcher events → SSE, 30s heartbeat, AbortController tracking
│   ├── sessions.ts       # /api/sessions, /api/sessions/:id, /messages, /tree
│   ├── parts.ts          # /api/parts/:id — lazy load single part
│   ├── plan.ts           # /api/plan — boulder.json progress
│   ├── health.ts         # /api/health + defaultProjectId
│   └── projects.ts       # /api/projects — available project list
├── services/
│   ├── pollService.ts    # fetchPollData() — aggregates all sources, ETag generation (SHA256), promise coalescing
│   ├── sessionService.ts # getSessionHierarchy() — tree building, phase detection, virtual sessions
│   └── statsService.ts   # Token/cost aggregation per model
├── storage/
│   ├── sessionParser.ts  # listAllSessions(), listProjects(), getSession()
│   ├── messageParser.ts  # listMessages(), getFirstAssistantMessage()
│   ├── partParser.ts     # parsePart(), getSessionActivityState(), formatCurrentAction(), getToolCallsForSession()
│   └── boulderParser.ts  # parseBoulder(), calculatePlanProgress() — regex checkbox parsing
├── utils/
│   ├── sessionStatus.ts  # Status thresholds: <30s=working, 30s-5min=idle, >5min=completed
│   └── projectResolver.ts # Maps projectID → directory path from session metadata
└── middleware/
    └── error.ts          # Global error handler + 404
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new endpoint | `routes/` | Create file + register in `routes/index.ts` |
| Change poll data shape | `services/pollService.ts` | `fetchPollData()` assembles `PollResponse` |
| Modify session tree | `services/sessionService.ts` | `getSessionHierarchy()` — virtual IDs for multi-agent phases |
| Parse new storage type | `storage/` | New parser → wire into pollService |
| Change status thresholds | `utils/sessionStatus.ts` | 30s/5min boundaries |
| Tool display names | `storage/partParser.ts` | `TOOL_DISPLAY_NAMES` dict + `formatCurrentAction()` |
| Activity state logic | `storage/partParser.ts` | `getSessionActivityState()` — pending/completed/reasoning |
| Cache tuning | `services/pollService.ts` | `POLL_CACHE_TTL_MS` (2s), epoch-based invalidation |

## KEY PATTERNS

**Caching**: In-memory Map keyed by projectID. TTL = 2s. `invalidatePollCache()` increments epoch. Poll route checks epoch unchanged before storing (prevents stale cache from race condition during concurrent invalidation).

**Promise coalescing**: `pollInProgressMap` stores in-flight Promise. Concurrent `/api/poll` requests share one fetch (no duplicate I/O).

**Watcher → SSE flow**: `Watcher.handleChange()` → 100ms debounce → emits `change` → SSE route calls `invalidatePollCache()` + pushes event to all connected clients.

**Session phases**: When `detectAgentPhases()` finds agent handoffs in a session's messages, `getSessionHierarchy()` creates virtual session IDs (`{id}-phase-{i}-{agentName}`) — each phase gets its own status, activity, and tool calls.

**Graceful degradation**: All storage parsers wrap `JSON.parse` in try/catch. Corrupted files → `console.warn` + skip (never crash). Missing directories → empty results.

## COMPLEXITY HOTSPOTS

| File | Lines | Concern |
|------|-------|---------|
| `storage/partParser.ts` | 532 | 12 exports mixing lazy-loading, state derivation, formatting |
| `services/sessionService.ts` | 476 | Recursive tree building + phase detection + child processing |
| `services/pollService.ts` | 254 | Multi-source aggregation + cache management |

## ANTI-PATTERNS

- Never bulk-read `part/` directory (25k+ files) — always lazy load via `getPart()`
- Never store session status — computed on-the-fly from timestamps + tool states
- Never exceed `MAX_RECURSION_DEPTH` (10) in tree building
- SSE route owns global watcher singleton — don't create additional watchers
