# CLIENT — React + Vite SPA

## OVERVIEW

Single-page dashboard rendering real-time agent sessions, activity streams, and plan progress. Dark theme only. React Context for state, SSE + polling for data, Tailwind for styling.

## STRUCTURE

```
client/
├── src/
│   ├── App.tsx                # Layout shell: header + sidebar + main + stream
│   ├── main.tsx               # React entrypoint (StrictMode + ErrorBoundary)
│   ├── components/
│   │   ├── graph/             # Stable activity tree visualization
│   │   │   ├── GraphView.tsx  # Main container: ReactFlow tree, toolbar, focus inspector, loading/empty states
│   │   │   ├── graphModel.ts  # Pure graph model + deterministic layout builder
│   │   │   ├── AgentNode.tsx  # Custom node card: agent badge, status, tools, tokens, timestamps
│   │   │   ├── AnimatedEdge.tsx # Lightweight smooth-step edges with status styling
│   │   │   ├── types.ts      # Graph-specific node/edge/layout types
│   │   │   └── index.ts      # Barrel exports
│   │   ├── ActivityStream.tsx # Bottom panel: flat event log of spawns + completions
│   │   ├── SessionList.tsx    # Sidebar: project dropdown + session list (198 lines)
│   │   ├── SessionStats.tsx   # Header stat dropdown with model breakdown
│   │   ├── PlanProgress.tsx   # Plan progress bar + task checklist
│   │   ├── AgentBadge.tsx     # Colored agent tag (memo'd)
│   │   ├── EmptyState.tsx     # Reusable empty state
│   │   ├── ErrorBoundary.tsx  # Class component error fallback
│   │   ├── LoadingSkeleton.tsx # Shimmer skeletons
│   │   └── sidebar/
│   │       ├── SidebarPlanProgress.tsx # Collapsible plan widget
│   │       ├── ActiveAgents.tsx        # Working/idle agents list
│   │       ├── ScopeSnapshot.tsx       # Session scope info
│   │       ├── StatusDot.tsx           # Status indicator dot
│   │       └── SystemHealth.tsx        # Health footer widget
│   ├── hooks/
│   │   ├── useSSE.ts              # SSE → polling fallback, liveness check (45s), debounce (100ms)
│   │   ├── usePolling.ts          # ETag polling, 2s interval, exponential backoff (max 10s)
│   │   ├── useSelectedActivityGraph.ts # Selected-session graph fetch with ETag + scope aborts
│   │   ├── useNotifications.ts    # Desktop notifications on waiting-user, 10s cooldown
│   │   └── useKeyboardShortcuts.ts # j/k/arrows navigate sessions, Escape deselects
│   ├── store/
│   │   ├── AppContext.tsx     # Provider composition only
│   │   ├── UIStateContext.tsx # Selected project/session and URL sync
│   │   └── PollDataContext.tsx # Poll/SSE data, connection state, selected graph data
│   ├── utils/
│   │   ├── agentColors.ts     # Agent → color mapping (sisyphus=blue, oracle=amber, explore=green...)
│   │   └── formatters.ts      # Token formatting (5.2K), cost formatting ($0.45)
│   └── styles/
│       ├── index.css          # Tailwind base imports
│       └── animations.css     # Custom keyframes: badge-glow, shimmer, waiting-user, attention
├── e2e/                       # Playwright specs (`*.pw.ts`)
├── vite.config.ts             # Vite + Vitest config, API proxy to :50234
└── tailwind.config.js         # Dark theme colors, class-based dark mode
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add component | `src/components/` | `.tsx`, Tailwind classes, read state from `useUIState()` / `usePollData()` |
| Add global state | `src/store/UIStateContext.tsx` / `src/store/PollDataContext.tsx` | Keep UI selection separate from fetched server data |
| Modify polling | `src/hooks/useSSE.ts` | SSE primary, polling fallback. Scope key = `sessionId|projectId` |
| Modify selected graph refresh | `src/hooks/useSelectedActivityGraph.ts` | Fetches `/api/sessions/:id/activity`, handles ETag 304 + scope aborts |
| Modify diagram layout | `src/components/graph/graphModel.ts` | Structure/content split, deterministic layout, focus/collapse rules |
| Agent colors | `src/utils/agentColors.ts` | Keyed by agent name prefix (case-insensitive) |
| Add animation | `src/styles/animations.css` | Custom keyframes, referenced via Tailwind `animate-*` |
| Sidebar widget | `src/components/sidebar/` | Small components consuming `useUIState()` / `usePollData()` |

## TESTING

- Client unit tests use `*.vitest.ts` / `*.vitest.tsx` and run via `cd src/client && bun run test`.
- Playwright specs use `*.pw.ts` and run via `cd src/client && bun run test:e2e`.
- Root `bun test` is intentionally scoped to the repo `src/` tree and does not run client Vitest or Playwright suites.

## DATA FLOW

```
AppProvider mounts
  → fetch /api/health + /api/projects (one-time init)
  → auto-select project: URL param → server default → first project
  → useSSE starts
    → tries EventSource(/api/sse) first
    → on SSE event: 100ms debounce → fetch /api/poll
    → on SSE failure: fallback to usePolling (2s interval)
    → ETag 304 skips JSON parsing
  → PollResponse → PollDataContext state
  → selecting a session starts useSelectedActivityGraph
    → fetch /api/sessions/:id/activity
    → ETag 304 preserves current graph state
  → Components read via useUIState() and usePollData()
```

## KEY PATTERNS

**Scope resets**: Changing project clears `selectedSessionId`, messages, and activitySessions. Scope key (`sessionId|projectId`) change resets ETag + aborts in-flight requests.

**Graph rendering**: The diagram is a stable monitoring-first tree. Layout recomputes on topology, collapse state, or direction changes, not on every status/timestamp update.

**Memoization**: `graphModel.ts` separates structure from content so status-only refreshes do not rebuild layout unnecessarily. `ActivityStream` memos filtered entries and agent lists to avoid cascade re-renders on 2s poll updates.

**URL sync**: `selectedProjectId` persists to `?project=` query param. Survives page reload. Priority: URL param → server default → first project.

**Notification guard**: `useNotifications` only fires on transition *to* waiting-user (not idle→working). 10s cooldown per session prevents spam.

## THEME

Single dark theme (GitHub-inspired). **No light mode, no customization.**

| Token | Hex | Usage |
|-------|-----|-------|
| background | `#0d1117` | Page background |
| surface | `#161b22` | Cards, panels |
| border | `#30363d` | All borders |
| text-primary | `#c9d1d9` | Main text |
| text-secondary | `#8b949e` | Dimmed text |
| accent | `#58a6ff` | Links, active states |
| success | `#238636` | Healthy/idle |
| warning | `#d29922` | Waiting-user, attention |
| error | `#f85149` | Errors |

## ANTI-PATTERNS

- No Redux/Zustand — Context API only
- No SSR — SPA only
- No CSS-in-JS — Tailwind only
- No light theme — single dark theme
- No component library (MUI, etc.) — custom components only
- No free-form graph editing — the diagram is a stable operational tree, not a whiteboard
