# Architectural Review & Cleanup Design

**Date:** 2026-03-06
**Scope:** Dead code removal, error handling, validation consistency, dependency alignment, structural refactors

## Approach

Two-phase, surgical passes:
- **Phase 1:** Quick wins — deletions, logging fixes, validation consistency, dep upgrades. No behavioral changes.
- **Phase 2:** Structural refactors — god file splits, context consolidation, shared hook extraction, constant centralization.

Each phase is independently shippable.

---

## Phase 1: Quick Wins

### 1a. Dead Code Removal

| Target | File | Action |
|--------|------|--------|
| `validateParam` | `src/server/validation.ts` | Delete (never called) |
| `buildAgentHierarchy` | `src/server/services/sessionService.ts` | Delete (never called) |
| `getSessionStatus` wrapper | `src/server/utils/sessionStatus.ts` | Delete, update tests to use `getSessionStatusInfo` |
| `BurstEntry` type | `src/shared/types/index.ts` | Delete (zero usage) |
| `StreamEntry` type | `src/shared/types/index.ts` | Delete (zero usage) |
| `AgentInfo` type | `src/shared/types/index.ts` | Delete, remove corresponding test |
| `AGENT_COLORS` export | `src/client/src/utils/agentColors.ts` | Delete object (only `getAgentColor()` used) |
| `extractPrimaryArg` re-export | `src/client/src/components/graph/index.ts` | Remove from barrel |
| `animate-slide-in-from-top` | `src/client/src/styles/animations.css` | Delete unused animation |
| `App.css` | `src/client/src/App.css` | Delete entire file |
| `index.css` | `src/client/src/index.css` | Delete file, remove import from `main.tsx` |
| Logic re-exports in types | `src/shared/types/index.ts` | Move `synthesizeActivityItems` and `RingBuffer` re-exports to `src/shared/index.ts` |

### 1b. Error Handling Upgrades (Logging Only)

| Target | File | Action |
|--------|------|--------|
| Silent catch in poll | `src/server/routes/poll.ts:52-54` | Add `console.warn` before clearing state |
| Boulder parse debug log | `src/server/services/pollService.ts:~350` | `console.debug` → `console.warn` |
| Non-null assertion | `src/shared/utils/activityUtils.ts:16` | Replace `!` with null check + skip |

### 1c. Validation Consistency

| Target | File | Action |
|--------|------|--------|
| Local `projectIdSchema` | `src/server/routes/poll.ts` | Move to `validation.ts` |
| Direct `safeParse` usage | `src/server/routes/poll.ts` | Switch to `validateWithResponse()` |

### 1d. Dependency Alignment

| Package | Current | Target |
|---------|---------|--------|
| `typescript` (root) | `^5.3.0` | `~5.9.3` (match client) |
| `hono` | `^4.11.7` | `^4.12.5` |
| `zod` | `^4.3.6` | `~4.3.6` |

---

## Phase 2: Structural Refactors

### 2a. Split `sessionService.ts` (548 lines)

| New File | Responsibility |
|----------|---------------|
| `src/server/services/sessionTree.ts` | `buildSessionTree()`, React Flow node/edge generation |
| `src/server/services/sessionPhases.ts` | Agent phase detection, virtual session IDs, `processChildSession()` |
| `src/server/services/sessionService.ts` | Orchestrator — `getSessionHierarchy()` delegates to new modules |

### 2b. Split `partParser.ts` (532 lines)

| New File | Responsibility |
|----------|---------------|
| `src/server/storage/partFormatter.ts` | `formatCurrentAction()`, `TOOL_DISPLAY_NAMES`, display text |
| `src/server/storage/partActivity.ts` | `getSessionActivityState()`, pending/completed/reasoning derivation |
| `src/server/storage/partParser.ts` | JSON → `PartMeta` parsing only |

### 2c. Consolidate Client Contexts

**Current:** `PollDataContext` → `SessionDetailContext` → `UIStateContext` → `AppContextBridge` (re-aggregates all three)

**Target:**
- Keep `PollDataContext` and `UIStateContext` as separate contexts
- Remove `AppContextBridge` — consumers import from specific context
- Absorb `SessionDetailContext` into `PollDataContext` (already triggered by poll changes)
- Components reading only UI state stop re-rendering on data changes

### 2d. Extract `useScopedFetch` Hook

Deduplicate shared pattern across `useSSE.ts`, `usePolling.ts`, `SessionDetailContext.tsx`:
- AbortController lifecycle
- Scope key validation (stale response rejection)
- ETag header management
- Error logging

Consumers become thin wrappers.

### 2e. Centralize Constants

Move to `src/shared/constants.ts`:
- `SESSION_SCAN_LIMIT` (from `src/server/routes/sessions.ts`)
- `MESSAGE_SCAN_LIMIT` (from `src/server/routes/sessions.ts`)
- `MAX_RECURSION_DEPTH` (from `src/server/services/sessionService.ts`)
- Notification cooldown `10_000` (from `src/client/src/hooks/useNotifications.ts`)

---

## Out of Scope

| Excluded | Reason |
|----------|--------|
| Accessibility (ARIA, contrast, focus) | Deprioritized — local dev tool |
| SSE infinite promise rewrite | Idiomatic for Hono SSE, works correctly |
| Request ID / correlation tracking | No debugging pain currently |
| Health check DB query | Low value for local SQLite |
| Code splitting / bundle optimization | No evidence of perf problems |
| Watcher ownership refactor | Low coupling in practice |
| E2E test expansion | Separate effort |
| React Flow virtualization | Won't hit scale limits |
