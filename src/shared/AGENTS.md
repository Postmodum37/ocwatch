# SHARED — Cross-Boundary Types & Utilities

## OVERVIEW

Shared code imported by both server and client. Contains the API contract (TypeScript interfaces), shared constants, and data transformation utilities.

## STRUCTURE

```
shared/
├── types/
│   └── index.ts           # 30+ interfaces — the single source of truth for API shapes
├── utils/
│   ├── RingBuffer.ts      # Generic circular buffer, enforces 1000-item cap
│   ├── activityUtils.ts   # synthesizeActivityItems() — sessions → activity feed
│   ├── burstGrouping.ts   # groupIntoBursts() — groups tool calls by agent + inserts milestones
│   └── formatTime.ts      # formatRelativeTime() / formatRelativeTimeVerbose()
├── constants.ts           # Shared constants (port, limits, TTLs)
├── index.ts               # Re-exports VERSION, PROJECT_NAME
└── __tests__/             # Unit tests for utils
```

## KEY TYPES (types/index.ts)

| Type | Role | Used By |
|------|------|---------|
| `PollResponse` | Main API payload shape | pollService → useSSE → AppContext |
| `SessionMetadata` | Session identity + status + timestamps | Everywhere |
| `ActivitySession` | Session enriched with tools, agent info, hierarchy | LiveActivity, ActivityStream |
| `PartMeta` | Single tool call with input/state/error | partParser, ActivityRow |
| `MessageMeta` | Message with tokens/cost/role | messageParser, stats |
| `ActivityItem` | Union: ToolCallActivity \| AgentSpawnActivity \| AgentCompleteActivity | Activity feed |
| `StreamEntry` | Union: BurstEntry \| MilestoneEntry | ActivityStream timeline |
| `SessionTree` | React Flow nodes + edges | AgentTree (disabled) |
| `PlanProgress` | Completed/total tasks + task list | PlanProgress, sidebar |
| `AgentPhase` | Agent handoff boundaries in a session | sessionService phase detection |

## CONSTANTS (constants.ts)

| Constant | Value | Purpose |
|----------|-------|---------|
| `DEFAULT_PORT` | 50234 | Server port |
| `POLL_CACHE_TTL_MS` | 2000 | Cache freshness window |
| `RINGBUFFER_CAPACITY` | 1000 | Max activity items in memory |
| `MAX_SESSIONS_LIMIT` | 20 | Sessions returned per poll |
| `MAX_MESSAGES_LIMIT` | 100 | Messages per session |
| `MAX_RECURSION_DEPTH` | 10 | Tree building depth limit |
| `TWENTY_FOUR_HOURS_MS` | 86400000 | Session recency window |

## KEY UTILITIES

**`synthesizeActivityItems(sessions)`**: Converts `ActivitySession[]` into flat `ActivityItem[]` — creates spawn events (parent→child), tool call events, and completion events. Deduplicates via `seenToolCallIds` Set.

**`groupIntoBursts(items)`**: Takes chronological `ActivityItem[]`, groups consecutive tool calls by same agent into `BurstEntry`, inserts `MilestoneEntry` for task completions. Threshold: new burst when agent changes.

**`RingBuffer<T>`**: Fixed-capacity circular buffer. `push()` overwrites oldest when full. Used to cap activity stream at 1000 entries.

## CONVENTIONS

- Types-only in `types/index.ts` — no runtime logic
- Utils must be side-effect-free (pure functions)
- Constants use `as const` for literal types
- All exports consumed by both server and client — changes affect both sides
