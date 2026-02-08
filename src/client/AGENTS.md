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
│   │   ├── graph/             # Force-directed graph visualization
│   │   │   ├── GraphView.tsx  # Main container: ReactFlow + force layout + loading/empty states
│   │   │   ├── AgentNode.tsx  # Custom node card: agent badge, status, tools, tokens, timestamps
│   │   │   ├── AnimatedEdge.tsx # Animated bezier edges with SVG particles for active connections
│   │   │   ├── useForceLayout.ts # d3-force simulation with RAF ticking, drag, reheat
│   │   │   ├── collide.ts    # Rectangular collision detection force for d3-force
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
│   │   ├── useNotifications.ts    # Desktop notifications on waiting-user, 10s cooldown
│   │   └── useKeyboardShortcuts.ts # j/k/arrows navigate sessions, Escape deselects
│   ├── store/
│   │   └── AppContext.tsx     # Global state: sessions, plan, projects, UI, connection status
│   ├── utils/
│   │   ├── agentColors.ts     # Agent → color mapping (sisyphus=blue, oracle=amber, explore=green...)
│   │   └── formatters.ts      # Token formatting (5.2K), cost formatting ($0.45)
│   └── styles/
│       ├── index.css          # Tailwind base imports
│       └── animations.css     # Custom keyframes: badge-glow, shimmer, waiting-user, attention
├── e2e/                       # Playwright: smoke.spec.ts, sse.spec.ts
├── vite.config.ts             # Vite + Vitest config, API proxy to :50234
└── tailwind.config.js         # Dark theme colors, class-based dark mode
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add component | `src/components/` | `.tsx`, Tailwind classes, use `useAppContext()` for state |
| Add global state | `src/store/AppContext.tsx` | Add to `AppContextValue` interface + `useMemo` |
| Modify polling | `src/hooks/useSSE.ts` | SSE primary, polling fallback. Scope key = `sessionId|projectId` |
| Agent colors | `src/utils/agentColors.ts` | Keyed by agent name prefix (case-insensitive) |
| Add animation | `src/styles/animations.css` | Custom keyframes, referenced via Tailwind `animate-*` |
| Sidebar widget | `src/components/sidebar/` | Small components consuming `useAppContext()` |

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
  → PollResponse → AppContext state
  → Components read via useAppContext()
```

## KEY PATTERNS

**Scope resets**: Changing project clears `selectedSessionId`, messages, and activitySessions. Scope key (`sessionId|projectId`) change resets ETag + aborts in-flight requests.

**Memoization**: `AgentNode` memos StatusIndicator, ActivityTypeIndicator. `ActivityStream` memos filtered entries, agent list. Prevents cascade re-renders on 2s poll updates.

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
- No dagre/tree layout — force-directed graph via `@xyflow/react` + `d3-force`
