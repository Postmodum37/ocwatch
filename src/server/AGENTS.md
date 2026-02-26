# SERVER — Bun + Hono Backend

## OVERVIEW

HTTP API server reading from OpenCode's SQLite database (`opencode.db`), computing session hierarchies and activity states, serving data via ETag-cached polling + SSE push.

## STRUCTURE

```
server/
├── index.ts              # Hono app, CORS, static serving, graceful shutdown (closeDb on exit)
├── cli.ts                # Flag parsing (--port, --project, --no-browser)
├── watcher.ts            # EventEmitter watching DB file + WAL + boulder.json, 100ms debounce
├── validation.ts         # Zod schemas: ses_[a-zA-Z0-9]+, [a-zA-Z0-9_-]+
├── routes/
│   ├── index.ts          # registerRoutes() wires all 7 modules
│   ├── poll.ts           # /api/poll — ETag 304, cache epoch check, dedup in-flight
│   ├── sse.ts            # /api/sse — watcher events → SSE, 30s heartbeat, AbortController tracking
│   ├── sessions.ts       # /api/sessions, /api/sessions/:id, /messages, /tree, /activity, /todos
│   ├── parts.ts          # /api/parts/:id — lazy load single part
│   ├── plan.ts           # /api/plan — boulder.json progress
│   ├── health.ts         # /api/health + defaultProjectId
│   └── projects.ts       # /api/projects — available project list
├── services/
│   ├── parsing.ts        # SINGLE SOURCE OF TRUTH for DB row → domain object mapping
│   ├── pollService.ts    # fetchPollData() — incremental state, ETag, promise coalescing, LRU eviction
│   ├── sessionService.ts # getSessionHierarchy() — tree building, phase detection, virtual sessions
│   └── statsService.ts   # Token/cost aggregation per model
├── storage/
│   ├── db.ts             # SQLite connection (bun:sqlite), singleton, read-only, WAL mode
│   ├── queries.ts        # Prepared statements for session/message/part/todo/project tables
│   ├── index.ts          # Barrel re-exports from db.ts + queries.ts + boulderParser.ts
│   └── boulderParser.ts  # parseBoulder(), calculatePlanProgress() — regex checkbox parsing
├── logic/
│   ├── activityLogic.ts  # isPendingToolCall, getSessionActivityState, formatCurrentAction, deriveActivityType, generateActivityMessage
│   ├── sessionLogic.ts   # getSessionStatusInfo, detectAgentPhases, isAssistantFinished
│   └── index.ts          # Barrel re-exports
├── utils/
│   ├── sessionStatus.ts  # Re-exports from logic + getStatusFromTimestamp, getSessionStatus convenience wrappers
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
| Change DB row parsing | `services/parsing.ts` | Single place for toSessionMetadata, toMessageMeta, toPartMeta |
| Add new SQL query | `storage/queries.ts` | Add prepared statement + export function |
| Change status thresholds | `utils/sessionStatus.ts` | 30s/5min boundaries |
| Tool display names | `logic/activityLogic.ts` | `TOOL_DISPLAY_NAMES` dict + `formatCurrentAction()` |
| Activity state logic | `logic/activityLogic.ts` | `getSessionActivityState()` — pending/completed/reasoning |
| Cache tuning | `services/pollService.ts` | `POLL_CACHE_TTL_MS` (2s), epoch-based invalidation |
| Agent phase detection | `logic/sessionLogic.ts` | `detectAgentPhases()` — agent handoff boundaries |

## KEY PATTERNS

**SQLite read-only**: Database opened with `{ readonly: true }`. Uses `bun:sqlite` prepared statements with column aliasing (`time_created AS timeCreated`). WAL mode for concurrent reads. Connection is singleton, closed on shutdown.

**Caching**: In-memory Map keyed by projectID. TTL = 2s. `invalidatePollCache()` increments epoch. Poll route checks epoch unchanged before storing. Incremental state capped at 10 entries (LRU eviction by oldest `lastTimestamp`).

**Promise coalescing**: `pollInProgressMap` stores in-flight Promise. Concurrent `/api/poll` requests share one fetch (no duplicate I/O).

**Watcher → SSE flow**: `Watcher` watches `opencode.db` + WAL file (prefers WAL when available) + `.sisyphus/boulder.json` → 100ms debounce → emits `change` → SSE route calls `invalidatePollCache()` + pushes event to all connected clients.

**Session phases**: When `detectAgentPhases()` finds agent handoffs in a session's messages, `getSessionHierarchy()` creates virtual session IDs (`{id}-phase-{i}-{agentName}`) — each phase gets its own status, activity, and tool calls.

**Graceful degradation**: Missing DB → `null` singleton, empty results (never crash). Corrupted JSON in data columns → `console.warn` + skip.

**Parsing deduplication**: All DB row → domain type conversion lives in `services/parsing.ts`. Both `pollService` and `sessionService` import from there — never duplicate parsing logic.

## COMPLEXITY HOTSPOTS

| File | Lines | Concern |
|------|-------|---------|
| `services/sessionService.ts` | ~550 | Recursive tree building + phase detection + child processing |
| `services/pollService.ts` | ~430 | Incremental state + multi-source aggregation + cache management |
| `logic/activityLogic.ts` | ~260 | Activity state derivation, tool display formatting |
| `storage/queries.ts` | ~325 | 10 prepared statements with column aliasing |

## ANTI-PATTERNS

- Never write to OpenCode's SQLite database — **read-only access**
- Never store session status — computed on-the-fly from timestamps + tool states
- Never exceed `MAX_RECURSION_DEPTH` (10) in tree building
- SSE route owns global watcher singleton — don't create additional watchers
- Never duplicate DB row parsing — use `services/parsing.ts`
- Never poll more frequently than 2s (`POLL_CACHE_TTL_MS`)
