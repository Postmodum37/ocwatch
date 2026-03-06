# Architectural Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up dead code, fix error handling, align dependencies, then refactor god files and consolidate client contexts.

**Architecture:** Two-phase approach. Phase 1 is pure deletion/fix work with zero behavioral changes (separate branch/PR). Phase 2 is structural refactoring that moves code between files and consolidates patterns (separate branch/PR).

**Tech Stack:** TypeScript, Bun, Hono, React, Vite, Tailwind CSS

---

## Phase 1: Quick Wins

Branch: `cleanup/phase-1-dead-code-and-fixes`

### Task 1: Delete Dead Server Code

**Files:**
- Modify: `src/server/validation.ts:12-14`
- Modify: `src/server/services/sessionService.ts:151-169`
- Modify: `src/server/utils/sessionStatus.ts:17-33`
- Modify: `src/server/__tests__/sessionStatus.test.ts:1-7,19-58`

**Step 1: Delete `validateParam` from validation.ts**

Remove lines 12-14 from `src/server/validation.ts`:
```typescript
// DELETE this function entirely:
export function validateParam<T>(schema: z.ZodSchema<T>, value: unknown): T {
  return schema.parse(value);
}
```

**Step 2: Delete `buildAgentHierarchy` from sessionService.ts**

Remove lines 151-169 from `src/server/services/sessionService.ts`:
```typescript
// DELETE this entire exported function — never called:
export function buildAgentHierarchy(messages: MessageMeta[]): Record<string, string[]> {
  // ...
}
```

**Step 3: Delete `getSessionStatus` wrapper from sessionStatus.ts**

Remove lines 17-33 from `src/server/utils/sessionStatus.ts` (the `getSessionStatus` function). Keep `getStatusFromTimestamp`, the re-exports, and constants.

**Step 4: Update sessionStatus tests to use `getSessionStatusInfo` directly**

In `src/server/__tests__/sessionStatus.test.ts`:
- Replace the import `getSessionStatus` with a local helper that calls `getSessionStatusInfo(...).status`
- Change line 3 import from:
```typescript
import {
  getSessionStatus,
  getSessionStatusInfo,
  getStatusFromTimestamp,
  isPendingToolCall,
} from "../utils/sessionStatus";
```
to:
```typescript
import {
  getSessionStatusInfo,
  getStatusFromTimestamp,
  isPendingToolCall,
} from "../utils/sessionStatus";
import type { MessageMeta } from "../../shared/types";

function getSessionStatus(
  messages: MessageMeta[],
  hasPendingToolCall = false,
  lastToolCompletedAt?: Date,
  workingChildCount?: number,
  lastAssistantFinished?: boolean,
  isSubagent = false
) {
  return getSessionStatusInfo(messages, hasPendingToolCall, lastToolCompletedAt, workingChildCount, lastAssistantFinished, isSubagent).status;
}
```

Note: `MessageMeta` is already imported on line 8 — just remove the duplicate and consolidate.

**Step 5: Run server tests**

Run: `bun test src/server src/shared`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/server/validation.ts src/server/services/sessionService.ts src/server/utils/sessionStatus.ts src/server/__tests__/sessionStatus.test.ts
git commit -m "refactor(server): remove unused exports (validateParam, buildAgentHierarchy, getSessionStatus)"
```

---

### Task 2: Delete Dead Shared Types

**Files:**
- Modify: `src/shared/types/index.ts:132-138,221-248`
- Modify: `src/shared/__tests__/types.test.ts:6,82-95`

**Step 1: Delete `AgentInfo` interface from types**

Remove lines 129-138 from `src/shared/types/index.ts`:
```typescript
// DELETE:
/**
 * AgentInfo represents an active agent
 */
export interface AgentInfo {
  name: string;
  mode: string;
  modelID: string;
  active: boolean;
  sessionID: string;
}
```

**Step 2: Delete `BurstEntry`, `MilestoneEntry`, and `StreamEntry` from types**

Remove lines 217-248 from `src/shared/types/index.ts` (the `BurstEntry` interface, `MilestoneEntry` interface, and `StreamEntry` type alias). Keep everything else.

Note: `MilestoneEntry` (lines 238-242) is only used as part of the `StreamEntry` union. Since `StreamEntry` is unused, `MilestoneEntry` is also dead. Delete all three.

**Step 3: Delete `AgentInfo` test from types.test.ts**

Remove lines 82-95 from `src/shared/__tests__/types.test.ts` (the `describe("AgentInfo", ...)` block).

Also remove `AgentInfo` from the import on line 6:
```typescript
// Change from:
import { SessionMetadata, MessageMeta, PartMeta, AgentInfo, ToolCall, PlanProgress, Boulder, RingBuffer } from "../types";
// To:
import { SessionMetadata, MessageMeta, PartMeta, ToolCall, PlanProgress, Boulder, RingBuffer } from "../types";
```

**Step 4: Run tests**

Run: `bun test src/shared`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/shared/types/index.ts src/shared/__tests__/types.test.ts
git commit -m "refactor(shared): remove unused types (AgentInfo, BurstEntry, MilestoneEntry, StreamEntry)"
```

---

### Task 3: Move Logic Re-exports Out of Types File

**Files:**
- Modify: `src/shared/types/index.ts:250,363`
- Modify: `src/shared/index.ts`

**Step 1: Remove re-exports from types/index.ts**

Remove these two lines from `src/shared/types/index.ts`:
```typescript
// Line 250 — DELETE:
export { synthesizeActivityItems } from '../utils/activityUtils';
// Line 363 — DELETE:
export { RingBuffer } from '../utils/RingBuffer';
```

**Step 2: Add re-exports to shared/index.ts**

Replace `src/shared/index.ts` with:
```typescript
export const VERSION = "0.1.0";
export const PROJECT_NAME = "OCWatch";

export { synthesizeActivityItems } from './utils/activityUtils';
export { RingBuffer } from './utils/RingBuffer';
```

**Step 3: Update all imports of synthesizeActivityItems and RingBuffer**

Find all files importing these from `../types` or `../../shared/types` and update to import from `../index` or `../../shared` or the direct util path instead.

Run: `grep -rn "synthesizeActivityItems\|RingBuffer" src/ --include="*.ts" --include="*.tsx"` to find all import sites.

Update each to import from the direct util path or from `@shared`:
- `import { synthesizeActivityItems } from '@shared/utils/activityUtils'`
- `import { RingBuffer } from '@shared/utils/RingBuffer'`

**Step 4: Run all tests**

Run: `bun test src/server src/shared && cd src/client && bun run test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/shared/types/index.ts src/shared/index.ts <any updated import files>
git commit -m "refactor(shared): move logic re-exports from types to shared/index and direct imports"
```

---

### Task 4: Delete Dead Client Code

**Files:**
- Delete: `src/client/src/App.css`
- Delete: `src/client/src/index.css`
- Modify: `src/client/src/utils/agentColors.ts:13-21`
- Modify: `src/client/src/components/graph/index.ts:6`
- Modify: `src/client/src/styles/animations.css:1-12,35-38`

**Step 1: Delete `App.css`**

Run: `rm src/client/src/App.css`

Verify no imports reference it:
Run: `grep -rn "App.css" src/client/`
Expected: No results (it's not imported anywhere)

**Step 2: Delete `index.css` (the Vite scaffold one)**

Run: `rm src/client/src/index.css`

Verify: `main.tsx` line 3 imports `./styles/index.css` (the real one), NOT `./index.css`. No import to update.

**Step 3: Delete `AGENT_COLORS` export from agentColors.ts**

Remove lines 13-21 from `src/client/src/utils/agentColors.ts`:
```typescript
// DELETE:
export const AGENT_COLORS = {
  sisyphus: '#3b82f6',
  prometheus: '#a855f7',
  explore: '#22c55e',
  librarian: '#22c55e',
  oracle: '#f59e0b',
  build: '#06b6d4',
  default: '#6b7280',
} as const;
```

**Step 4: Remove `extractPrimaryArg` from barrel export**

In `src/client/src/components/graph/index.ts`, change line 6 from:
```typescript
export { extractPrimaryArg, getFullToolDisplayText } from './nodeHelpers';
```
to:
```typescript
export { getFullToolDisplayText } from './nodeHelpers';
```

**Step 5: Delete unused `animate-slide-in-from-top` animation**

In `src/client/src/styles/animations.css`, remove the `slide-in-from-top` keyframes (lines 1-12) and its utility class (lines 35-38):
```css
/* DELETE lines 1-12: */
@keyframes slide-in-from-top { ... }

/* DELETE lines 35-38: */
.animate-slide-in-from-top {
  animation: slide-in-from-top 200ms ease-out forwards;
}
```

Keep everything else starting from `@keyframes pulse-bg`.

**Step 6: Run client tests and build**

Run: `cd src/client && bun run test && bun run build`
Expected: Tests pass, build succeeds

**Step 7: Commit**

```bash
git add -A src/client/src/App.css src/client/src/index.css src/client/src/utils/agentColors.ts src/client/src/components/graph/index.ts src/client/src/styles/animations.css
git commit -m "refactor(client): remove dead CSS files, unused exports, and unused animation"
```

---

### Task 5: Fix Error Handling (Logging Only)

**Files:**
- Modify: `src/server/routes/poll.ts:52-54`
- Modify: `src/server/services/pollService.ts:351`
- Modify: `src/shared/utils/activityUtils.ts:16`

**Step 1: Add warning log to silent catch in poll.ts**

In `src/server/routes/poll.ts`, change lines 52-54 from:
```typescript
      } catch {
        setPollInProgress(null, projectId);
      }
```
to:
```typescript
      } catch (err) {
        console.warn("Poll request failed, retrying:", err instanceof Error ? err.message : err);
        setPollInProgress(null, projectId);
      }
```

**Step 2: Upgrade boulder parse log level**

In `src/server/services/pollService.ts`, change line 351 from:
```typescript
      console.debug("Failed to parse boulder.json:", err instanceof Error ? err.message : err);
```
to:
```typescript
      console.warn("Failed to parse boulder.json:", err instanceof Error ? err.message : err);
```

**Step 3: Replace non-null assertion in activityUtils.ts**

In `src/shared/utils/activityUtils.ts`, change line 15-16 from:
```typescript
    if (session.parentID && sessionMap.has(session.parentID)) {
      const parent = sessionMap.get(session.parentID)!;
```
to:
```typescript
    if (session.parentID) {
      const parent = sessionMap.get(session.parentID);
      if (!parent) return;
```

Note: the `return` is inside a `forEach` callback, so it skips this iteration.

**Step 4: Run tests**

Run: `bun test src/server src/shared`
Expected: All pass

**Step 5: Commit**

```bash
git add src/server/routes/poll.ts src/server/services/pollService.ts src/shared/utils/activityUtils.ts
git commit -m "fix(server): add warning logs for silent catches, fix non-null assertion in activityUtils"
```

---

### Task 6: Validation Consistency

**Files:**
- Modify: `src/server/validation.ts`
- Modify: `src/server/routes/poll.ts:2,14,21-29`

**Step 1: Add `projectIdSchema` to validation.ts**

Add to `src/server/validation.ts` after line 6:
```typescript
export const projectIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/, 'Invalid project ID format');
```

**Step 2: Refactor poll.ts to use shared validation**

In `src/server/routes/poll.ts`:

Remove line 2 (`import { z } from "zod"`) and line 14 (`const projectIdSchema = ...`).

Add to the imports from `../validation`:
```typescript
import { projectIdSchema, validateWithResponse } from "../validation";
```

Replace lines 21-29 (the manual safeParse block):
```typescript
    let projectId: string | undefined;

    if (rawProjectId) {
      const result = projectIdSchema.safeParse(rawProjectId);
      if (!result.success) {
        return c.json({ error: "INVALID_PROJECT_ID", message: "Invalid project ID format" }, 400);
      }
      projectId = result.data;
    }
```
with:
```typescript
    let projectId: string | undefined;

    if (rawProjectId) {
      const validation = validateWithResponse(projectIdSchema, rawProjectId, c);
      if (!validation.success) return validation.response;
      projectId = validation.value;
    }
```

**Step 3: Run tests**

Run: `bun test src/server`
Expected: All pass

**Step 4: Commit**

```bash
git add src/server/validation.ts src/server/routes/poll.ts
git commit -m "refactor(server): centralize projectIdSchema in validation.ts, use validateWithResponse in poll route"
```

---

### Task 7: Dependency Alignment

**Files:**
- Modify: `package.json:52-53,57`

**Step 1: Update dependency versions in root package.json**

In `package.json`, update:
```json
"dependencies": {
  "hono": "^4.12.5",
  "zod": "~4.3.6"
},
"devDependencies": {
  "@types/bun": "latest",
  "typescript": "~5.9.3"
}
```

**Step 2: Install updated dependencies**

Run: `bun install`
Expected: Resolves without errors

**Step 3: Run full test suite**

Run: `bun test src/server src/shared && cd src/client && bun run test`
Expected: All pass

**Step 4: Run type check**

Run: `bun run tsc -b`
Expected: No errors

**Step 5: Build client**

Run: `cd src/client && bun run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(deps): align TypeScript ~5.9.3, update hono ^4.12.5, tighten zod ~4.3.6"
```

---

### Task 8: Phase 1 Verification and PR

**Step 1: Run full test suite one final time**

Run: `bun test src/server src/shared && cd src/client && bun run test`
Expected: All pass

**Step 2: Run type check**

Run: `bun run tsc -b`
Expected: No errors

**Step 3: Build and verify**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Create PR**

```bash
git push -u origin cleanup/phase-1-dead-code-and-fixes
gh pr create --title "refactor: phase 1 cleanup — dead code, error handling, deps" --body "## Summary
- Remove unused exports: validateParam, buildAgentHierarchy, getSessionStatus, AGENT_COLORS, extractPrimaryArg
- Remove unused types: AgentInfo, BurstEntry, MilestoneEntry, StreamEntry
- Delete Vite scaffold CSS (App.css, index.css)
- Delete unused animation (slide-in-from-top)
- Move logic re-exports out of types/index.ts
- Add warning logs for silent catches in poll route and boulder parser
- Fix non-null assertion in synthesizeActivityItems
- Centralize projectIdSchema in validation.ts
- Align TypeScript to ~5.9.3, update hono, tighten zod

## Test plan
- [x] bun test (server + shared)
- [x] vitest (client)
- [x] tsc -b (type check)
- [x] bun run build (production build)"
```

---

## Phase 2: Structural Refactors

Branch: `cleanup/phase-2-structural-refactors` (off main after Phase 1 merges)

### Task 9: Centralize Scan Limit Constants

**Files:**
- Modify: `src/shared/constants.ts`
- Modify: `src/server/services/pollService.ts:46-48`
- Modify: `src/server/routes/sessions.ts:17`
- Modify: `src/client/src/hooks/useNotifications.ts:110`

**Step 1: Add constants to shared/constants.ts**

Add to `src/shared/constants.ts`:
```typescript
/** Internal upper bound for session queries (not client-facing) */
export const SESSION_SCAN_LIMIT = 50_000 as const;
/** Internal upper bound for message queries per session (not client-facing) */
export const MESSAGE_SCAN_LIMIT = 10_000 as const;
/** Cooldown between notifications for the same session (ms) */
export const NOTIFICATION_COOLDOWN_MS = 10_000 as const;
```

**Step 2: Update pollService.ts**

In `src/server/services/pollService.ts`, remove lines 46-48:
```typescript
const SESSION_SCAN_LIMIT = 50_000;
const MESSAGE_SCAN_LIMIT = 10_000;
```

Add to the import from `../../shared/constants`:
```typescript
import {
  TWENTY_FOUR_HOURS_MS,
  MAX_SESSIONS_LIMIT,
  MAX_MESSAGES_LIMIT,
  POLL_CACHE_TTL_MS,
  SESSION_SCAN_LIMIT,
  MESSAGE_SCAN_LIMIT,
} from "../../shared/constants";
```

**Step 3: Update sessions.ts**

In `src/server/routes/sessions.ts`, remove line 17:
```typescript
const SESSION_SCAN_LIMIT = 50_000;
```

Add `SESSION_SCAN_LIMIT` to the import from `../../shared/constants` on line 14.

**Step 4: Update useNotifications.ts**

In `src/client/src/hooks/useNotifications.ts`, replace the hardcoded `10_000` on line 110 with `NOTIFICATION_COOLDOWN_MS` imported from `@shared/constants`.

**Step 5: Run tests**

Run: `bun test src/server src/shared && cd src/client && bun run test`
Expected: All pass

**Step 6: Commit**

```bash
git add src/shared/constants.ts src/server/services/pollService.ts src/server/routes/sessions.ts src/client/src/hooks/useNotifications.ts
git commit -m "refactor: centralize SESSION_SCAN_LIMIT, MESSAGE_SCAN_LIMIT, NOTIFICATION_COOLDOWN_MS in shared constants"
```

---

### Task 10: Split sessionService.ts — Extract sessionTree.ts

**Files:**
- Create: `src/server/services/sessionTree.ts`
- Modify: `src/server/services/sessionService.ts`
- Modify: `src/server/routes/sessions.ts` (import update)

**Step 1: Create sessionTree.ts**

Create `src/server/services/sessionTree.ts` containing:
- The `buildSessionTree` function (currently lines 171-244 of sessionService.ts)
- The helper functions it uses: `createSessionContext`, `getSessionFromContext`, `getSessionMessages`, `getSessionChildren` — BUT these are also used by `getSessionHierarchy`, so they stay in sessionService.ts and get exported.

Actually, the cleanest split: extract the `SessionContext` type and its helper functions into a shared internal module, then both files import from it.

Create `src/server/services/sessionContext.ts` with:
- `SessionContext` interface (lines 43-49)
- `createSessionContext` (lines 52-65)
- `getSessionFromContext` (lines 67-69)
- `getSessionMessages` (lines 71-80)
- `getSessionParts` (lines 82-91)
- `getSessionChildren` (lines 93-111)
- `MAX_MESSAGE_QUERY_LIMIT` constant (line 41)

Create `src/server/services/sessionTree.ts` with:
- `buildSessionTree` function (lines 171-244)
- Imports `SessionContext` helpers from `./sessionContext`

**Step 2: Update sessionService.ts**

Remove the extracted functions and import them from `./sessionContext`:
```typescript
import {
  createSessionContext,
  getSessionFromContext,
  getSessionMessages,
  getSessionParts,
  getSessionChildren,
} from "./sessionContext";
```

Remove `MAX_MESSAGE_QUERY_LIMIT`, `SessionContext`, `createSessionContext`, `getSessionFromContext`, `getSessionMessages`, `getSessionParts`, `getSessionChildren` from sessionService.ts.

Remove `buildSessionTree` and move to sessionTree.ts.

**Step 3: Update sessions.ts import**

In `src/server/routes/sessions.ts`, change:
```typescript
import { buildSessionTree } from "../services/sessionService";
```
to:
```typescript
import { buildSessionTree } from "../services/sessionTree";
```

**Step 4: Run tests**

Run: `bun test src/server`
Expected: All pass

**Step 5: Commit**

```bash
git add src/server/services/sessionContext.ts src/server/services/sessionTree.ts src/server/services/sessionService.ts src/server/routes/sessions.ts
git commit -m "refactor(server): extract sessionContext and sessionTree from sessionService"
```

---

### Task 11: Split sessionService.ts — Extract processChildSession

**Files:**
- Modify: `src/server/services/sessionService.ts`

**Step 1: Move processChildSession to its own file or keep inline**

Looking at the code, `processChildSession` (lines 445-548) is tightly coupled with `getSessionHierarchy` — they share the same `result` array, `processed` set, and call the same helpers. Extracting it to a separate file would require passing many parameters or creating a class.

**Decision:** Keep `processChildSession` in `sessionService.ts` but make it a private function (remove `export`). It's only called from `getSessionHierarchy` within the same file, and from the Phase 2 extraction above.

Check if it's exported and used externally:
- It's exported on line 445 but only called within the same file (lines 339, 437, 545).

Remove the `export` keyword from `processChildSession`.

**Step 2: Run tests**

Run: `bun test src/server`
Expected: All pass

**Step 3: Commit**

```bash
git add src/server/services/sessionService.ts
git commit -m "refactor(server): make processChildSession private (only used internally)"
```

---

### Task 12: Consolidate Client Contexts

This is the most complex task. Read the existing context files first.

**Files:**
- Modify: `src/client/src/store/AppContext.tsx`
- Modify: `src/client/src/store/PollDataContext.tsx`
- Delete: `src/client/src/store/SessionDetailContext.tsx` (absorb into PollDataContext)
- Modify: `src/client/src/store/UIStateContext.tsx`
- Modify: `src/client/src/App.tsx`
- Modify: All components that import from `AppContext`

**Step 1: Read all context files**

Read these files to understand current structure:
- `src/client/src/store/AppContext.tsx`
- `src/client/src/store/PollDataContext.tsx`
- `src/client/src/store/SessionDetailContext.tsx`
- `src/client/src/store/UIStateContext.tsx`

**Step 2: Absorb SessionDetailContext into PollDataContext**

Move the session detail fetching logic (selected session detail, messages, activity) from `SessionDetailContext` into `PollDataContext`. The detail fetch is already triggered by poll data changes.

**Step 3: Remove AppContextBridge**

Replace `AppContextBridge` with direct context imports. Components should import from `usePollData()` or `useUIState()` directly instead of `useAppContext()`.

Find all components using `useAppContext()` and update their imports:
```bash
grep -rn "useAppContext" src/client/src/
```

For each component:
- If it only reads poll data → `usePollData()`
- If it only reads UI state → `useUIState()`
- If it reads both → import both hooks

**Step 4: Update App.tsx provider nesting**

Simplify the provider hierarchy from:
```tsx
<PollDataProvider>
  <SessionDetailProvider>
    <UIStateProvider>
      <AppContextBridge>
        {children}
      </AppContextBridge>
    </UIStateProvider>
  </SessionDetailProvider>
</PollDataProvider>
```
to:
```tsx
<PollDataProvider>
  <UIStateProvider>
    {children}
  </UIStateProvider>
</PollDataProvider>
```

**Step 5: Run client tests**

Run: `cd src/client && bun run test && bun run build`
Expected: All pass and build succeeds

**Step 6: Commit**

```bash
git add src/client/src/store/ src/client/src/App.tsx src/client/src/components/
git commit -m "refactor(client): consolidate contexts — remove AppContextBridge, absorb SessionDetailContext into PollDataContext"
```

---

### Task 13: Extract useScopedFetch Hook

**Files:**
- Create: `src/client/src/hooks/useScopedFetch.ts`
- Modify: `src/client/src/hooks/useSSE.ts`
- Modify: `src/client/src/hooks/usePolling.ts`

**Step 1: Read both hooks to identify shared pattern**

Read `useSSE.ts` and `usePolling.ts` to identify the exact shared fetch pattern:
- AbortController creation/cleanup
- Scope key ref management
- ETag header passing
- Stale response rejection
- Error logging

**Step 2: Create useScopedFetch.ts**

Extract the common pattern into a reusable hook:
```typescript
export function useScopedFetch(scopeKey: string) {
  // Returns: { fetchWithScope, abortController, isStale }
  // Handles: abort on unmount, scope key tracking, stale rejection
}
```

**Step 3: Refactor useSSE.ts and usePolling.ts**

Replace inline scope/abort logic with `useScopedFetch`. Keep SSE-specific and polling-specific logic in their respective hooks.

**Step 4: Run tests**

Run: `cd src/client && bun run test && bun run build`
Expected: All pass

**Step 5: Commit**

```bash
git add src/client/src/hooks/useScopedFetch.ts src/client/src/hooks/useSSE.ts src/client/src/hooks/usePolling.ts
git commit -m "refactor(client): extract useScopedFetch hook to deduplicate fetch logic"
```

---

### Task 14: Phase 2 Verification and PR

**Step 1: Run full test suite**

Run: `bun test src/server src/shared && cd src/client && bun run test`
Expected: All pass

**Step 2: Type check**

Run: `bun run tsc -b`
Expected: No errors

**Step 3: Build**

Run: `bun run build`
Expected: Succeeds

**Step 4: Create PR**

```bash
git push -u origin cleanup/phase-2-structural-refactors
gh pr create --title "refactor: phase 2 — structural cleanup" --body "## Summary
- Centralize scan limits and notification cooldown in shared/constants.ts
- Extract sessionContext.ts and sessionTree.ts from sessionService.ts (548→~200 lines)
- Make processChildSession private
- Consolidate client contexts: remove AppContextBridge, absorb SessionDetailContext
- Extract useScopedFetch hook from useSSE/usePolling

## Test plan
- [x] bun test (server + shared)
- [x] vitest (client)
- [x] tsc -b (type check)
- [x] bun run build (production build)"
```
