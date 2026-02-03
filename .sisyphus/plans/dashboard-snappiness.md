# Dashboard Snappiness & Liveness Improvements

## TL;DR

> **Quick Summary**: Replace polling with SSE for instant updates and add Motion animations for a snappy, lively dashboard that feels "calm when idle, alive when active".
> 
> **Deliverables**:
> - SSE endpoint (`/api/sse`) pushing session + plan changes instantly
> - Motion-powered animations for ActivityStream (enter/exit/layout)
> - Shimmer loading skeletons (CSS-only)
> - Enhanced live indicators with prominent pulse on activity
> - "Jump to latest" button for ActivityStream when user scrolls up
> - "New activity" badge when ActivityStream is collapsed
> 
> **Estimated Effort**: Large (SSE + animations + tests)
> **Parallel Execution**: YES - 4 waves (9 tasks)
> **Critical Path**: SSE Backend → useSSE Hook → Playwright Setup → E2E Integration

---

## Context

### Original Request
"Make dashboard snappier and more lively. Research and implement better data fetching methods that would feel more live - don't think polling is enough. Also invest more time researching and designing the UI/UX so that it would feel more modern, snappy and clean."

### Interview Summary
**Key Discussions**:
- **Animation approach**: Motion library (~12kb) for rich AnimatePresence effects
- **Design scope**: Meaningful refresh with focus on ActivityStream, LiveActivity, Status indicators, Loading states
- **SSE scope**: Push both session activity AND plan progress via SSE
- **Delivery**: Ship backend + frontend together as cohesive improvement
- **Design direction**: "Calm when idle, alive when active" - Linear/Vercel hybrid
- **ActivityStream height**: Larger (h-80 max-h-[50vh]) with "new activity" badge when collapsed
- **Scroll behavior**: Don't auto-scroll if user scrolled up; show "Jump to latest" button
- **Testing**: TDD approach

**Research Findings**:
- Hono has `streamSSE()` in `hono/streaming` - perfect for this use case
- Existing watcher already emits `change` events - just needs SSE connection
- Motion (`motion/react`) is lighter than `framer-motion` with same API
- CSS-only shimmer is sufficient, no JS animation needed for loading states

### Metis Review
**Identified Gaps** (addressed):
- **SSE heartbeat**: Added 30s heartbeat for connection health
- **Reduced motion**: Will respect `prefers-reduced-motion` via Motion
- **Tab visibility**: Reconnect SSE on `visibilitychange`
- **Activity burst**: Debounce 100ms to prevent animation jank
- **Multiple tabs**: Each gets SSE connection (Bun handles fine)
- **Scroll behavior**: Confirmed "Jump to latest" UX

---

## Work Objectives

### Core Objective
Transform OCWatch from a polling-based dashboard to a real-time, animated monitoring experience that feels instantly responsive and visually alive during agent activity.

### Concrete Deliverables
- `/api/sse` endpoint streaming session + plan updates
- `useSSE` React hook with polling fallback
- Motion-animated ActivityStream (enter/exit/layout)
- Shimmer loading skeletons (CSS-only)
- Enhanced live indicators
- "New activity" badge on collapsed ActivityStream
- "Jump to latest" floating button

### Definition of Done
- [x] `curl -N http://localhost:50234/api/sse` receives heartbeat within 35s
- [x] File change triggers SSE event within 200ms
- [x] Animation appears on new activity item (Playwright assertion)
- [x] Shimmer skeleton visible during initial load
- [x] `bun test` passes (server)
- [x] `cd src/client && bun run test` passes (client)

### Must Have
- SSE with automatic reconnection and polling fallback
- AnimatePresence for ActivityStream item enter/exit
- Shimmer skeleton for loading states
- Reduced motion support (`prefers-reduced-motion`)
- TDD with existing test infrastructure

### Must NOT Have (Guardrails)
- **No WebSocket** - SSE is sufficient for read-only push
- **No SessionList animations** - Out of scope
- **No AgentTree animations** - Out of scope
- **No toast notifications** - Not requested
- **No sound/haptic feedback** - Not requested
- **No custom spring configs** - Use Motion defaults
- **Animation duration max 300ms** - Prevent jank
- **No server-side filtering** - Client filters by context
- **No SSE authentication** - Match existing API behavior

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> Every criterion is verified by running a command or using a tool.

### Test Decision
- **Infrastructure exists**: YES (bun test for server, vitest for client)
- **Automated tests**: TDD
- **Framework**: bun test (server), vitest (client)

### Agent-Executed QA (MANDATORY for all tasks)

**Backend Verification (curl/bash):**
- SSE connection test with timeout assertions
- Heartbeat verification within 35s
- Event push verification on file touch

**Frontend Verification (Playwright):**
- Animation visibility assertions with timing
- Shimmer skeleton appearance
- Reduced motion behavior
- "Jump to latest" button appearance

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: SSE endpoint + watcher integration
└── Task 4: Install Motion + shimmer CSS

Wave 2 (After Wave 1):
├── Task 2: useSSE hook with polling fallback (depends: 1)
├── Task 3: Setup Playwright E2E infrastructure (depends: 4)
├── Task 5: ActivityStream animations (depends: 4)
└── Task 6: Enhanced live indicators (depends: 4)

Wave 3 (After Wave 2):
├── Task 3a: Integration + E2E tests (depends: 2, 3)
└── Task 7: ActivityStream UX (badge + jump) (depends: 5)

Wave 4 (Final):
└── Task 8: Loading skeleton integration (depends: 4, 5)

Critical Path: Task 1 → Task 2 → Task 3a
Parallel Speedup: ~35% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2 | 4 |
| 2 | 1 | 3a | 3, 5, 6 |
| 3 | 4 | 3a | 2, 5, 6 |
| 3a | 2, 3 | None | 7, 8 |
| 4 | None | 3, 5, 6, 8 | 1 |
| 5 | 4 | 7 | 2, 3, 6 |
| 6 | 4 | None | 2, 3, 5 |
| 7 | 5 | None | 3a, 8 |
| 8 | 4, 5 | None | 3a, 7 |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Category |
|------|-------|---------------------|
| 1 | 1, 4 | quick (independent setup tasks) |
| 2 | 2, 3, 5, 6 | visual-engineering (hook + animations + playwright setup) |
| 3 | 3a, 7 | quick (integration tests + UX polish) |
| 4 | 8 | quick (skeleton integration) |

---

## TODOs

- [x] 1. SSE Endpoint + Watcher Integration

  **What to do**:
  - Create `/api/sse` endpoint using `streamSSE()` from `hono/streaming`
  - Connect existing `Watcher` class events to SSE stream
  - Broadcast `session-update`, `message-update`, `plan-update` events
  - Add 30s heartbeat to keep connection alive
  - Handle client disconnect via `stream.onAbort()` cleanup
  - Write tests for SSE endpoint

  **Must NOT do**:
  - Do NOT add authentication to SSE endpoint
  - Do NOT filter events server-side
  - Do NOT remove `/api/poll` endpoint (needed for fallback)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused backend task with clear Hono patterns, existing watcher to connect
  - **Skills**: []
    - No special skills needed - standard TypeScript/Hono work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 4)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/server/watcher.ts:16-102` - Existing Watcher class with EventEmitter, `change` event emission
  - `src/server/routes/poll.ts:14-79` - Current poll route pattern (for consistency)
  - `src/server/services/pollService.ts:1-50` - Data fetching pattern (`fetchPollData()`)

  **API/Type References**:
  - `src/shared/types/index.ts:SessionMetadata` - Session data shape for events
  - `src/shared/types/index.ts:PlanProgress` - Plan data shape for events

  **Test References**:
  - `src/server/__tests__/watcher.test.ts` - Watcher test patterns (mock fs.watch)
  - `src/server/__tests__/routes.test.ts` - Route testing patterns

  **External References**:
  - Hono SSE docs: `streamSSE()` from `hono/streaming` - https://hono.dev/docs/helpers/streaming#streamsse

  **Acceptance Criteria**:

  **TDD Tests:**
  - [ ] Test file: `src/server/__tests__/sse.test.ts`
  - [ ] Test: SSE endpoint returns `text/event-stream` content type
  - [ ] Test: Watcher `change` event triggers SSE message
  - [ ] Test: Heartbeat sent within 30s
  - [ ] `bun test src/server/__tests__/sse.test.ts` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: SSE connection stays open and receives heartbeat
    Tool: Bash (curl)
    Preconditions: Server running on localhost:50234
    Steps:
      1. curl -s -N -H "Accept: text/event-stream" http://localhost:50234/api/sse > /tmp/sse_output.txt &
      2. SSE_PID=$!
      3. sleep 35
      4. kill $SSE_PID 2>/dev/null
      5. grep -c "event: heartbeat" /tmp/sse_output.txt
    Expected Result: At least 1 heartbeat event received
    Evidence: /tmp/sse_output.txt content

  Scenario: File change triggers SSE event
    Tool: Bash
    Preconditions: Server running, SSE connected, XDG_DATA_HOME or ~/.local/share/Claude exists
    Steps:
      1. STORAGE_PATH="${XDG_DATA_HOME:-$HOME/.local/share}/Claude/opencode/storage/session"
      2. curl -s -N http://localhost:50234/api/sse > /tmp/sse_trigger.txt &
      3. SSE_PID=$!
      4. sleep 2
      5. mkdir -p "$STORAGE_PATH/test" && touch "$STORAGE_PATH/test/test.json" 2>/dev/null || echo "skip - no storage dir"
      6. sleep 1
      7. kill $SSE_PID 2>/dev/null
      8. cat /tmp/sse_trigger.txt
    Expected Result: Event received (session-update) or heartbeat if storage dir unavailable
    Evidence: /tmp/sse_trigger.txt
    Note: If storage directory doesn't exist, test verifies heartbeat works. Full E2E tested in Task 3.
  ```

  **Commit**: YES
  - Message: `feat(server): add SSE endpoint for real-time updates`
  - Files: `src/server/routes/sse.ts`, `src/server/routes/index.ts`, `src/server/__tests__/sse.test.ts`
  - Pre-commit: `bun test`

---

- [x] 2. useSSE Hook with Polling Fallback

  **What to do**:
  - Create `useSSE` hook that connects to `/api/sse`
  - Implement automatic reconnection on disconnect
  - Fall back to existing `usePolling` when SSE fails
  - Handle `visibilitychange` event (reconnect when tab becomes visible)
  - Debounce incoming events by 100ms to batch rapid updates
  - Write tests for hook behavior

  **Must NOT do**:
  - Do NOT run SSE and polling simultaneously
  - Do NOT block UI on SSE connection attempt

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: React hook with state management, UI integration
  - **Skills**: []
    - Standard React hook patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/client/src/hooks/usePolling.ts:31-197` - Existing polling hook with retry logic, abort handling
  - `src/client/src/store/AppContext.tsx:34-42` - Hook usage pattern in context

  **Test References**:
  - `src/client/src/hooks/__tests__/usePolling.test.tsx` - Hook testing patterns

  **External References**:
  - EventSource API: `new EventSource(url)`, `.onmessage`, `.onerror`, `.close()`
  - Vercel's useAgentStream pattern (from grep_app research)

  **Acceptance Criteria**:

  **TDD Tests:**
  - [ ] Test file: `src/client/src/hooks/__tests__/useSSE.test.tsx`
  - [ ] Test: Connects to SSE on mount, disconnects on unmount
  - [ ] Test: Falls back to polling after SSE failure
  - [ ] Test: Reconnects SSE on `visibilitychange` (tab visible)
  - [ ] Test: Debounces rapid events (100ms)
  - [ ] `cd src/client && bun run test src/hooks/__tests__/useSSE.test.tsx` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: SSE connection established in browser
    Tool: Playwright (playwright skill)
    Preconditions: Server running, dev client running
    Steps:
      1. Navigate to: http://localhost:5173
      2. Open DevTools Network tab (via page.on('request'))
      3. Wait for request to /api/sse
      4. Assert: Request type is EventSource (Accept: text/event-stream)
      5. Assert: Connection status is open
    Expected Result: SSE connection established
    Evidence: Network request log

  Scenario: Fallback to polling on SSE failure
    Tool: Playwright (playwright skill)
    Preconditions: Server running but /api/sse returns 500
    Steps:
      1. Mock /api/sse to return 500 error
      2. Navigate to dashboard
      3. Wait 5 seconds
      4. Assert: /api/poll requests are being made
    Expected Result: Polling active as fallback
    Evidence: Network request log showing /api/poll calls
  ```

  **Commit**: YES
  - Message: `feat(client): add useSSE hook with polling fallback`
  - Files: `src/client/src/hooks/useSSE.ts`, `src/client/src/hooks/__tests__/useSSE.test.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [x] 3. Setup Playwright E2E Infrastructure

  **What to do**:
  - Install Playwright: `cd src/client && bun add -d @playwright/test`
  - Create `src/client/playwright.config.ts` with basic configuration
  - Add `test:e2e` script to `src/client/package.json`: `"test:e2e": "playwright test"`
  - Create `src/client/e2e/` directory for E2E tests
  - Write a simple smoke test to verify setup: `e2e/smoke.spec.ts`
  - Verify: `cd src/client && bun run test:e2e` runs successfully

  **Must NOT do**:
  - Do NOT install browser binaries globally (use `npx playwright install` as needed)
  - Do NOT overconfigure - keep playwright.config minimal

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Infrastructure setup, well-documented Playwright patterns
  - **Skills**: [`playwright`]
    - Playwright configuration knowledge

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 5, 6) - can start once Motion is installed
  - **Blocks**: Task 3a (Integration + E2E Tests)
  - **Blocked By**: Task 4 (needs client package.json ready)

  **References**:

  **External References**:
  - Playwright Bun setup: https://playwright.dev/docs/intro
  - Config template: `defineConfig({ testDir: './e2e', use: { baseURL: 'http://localhost:5173' } })`

  **Acceptance Criteria**:

  **TDD Tests:**
  - [ ] `src/client/playwright.config.ts` exists
  - [ ] `src/client/e2e/smoke.spec.ts` exists
  - [ ] `cd src/client && bun run test:e2e` → PASS (smoke test)

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Playwright smoke test passes
    Tool: Bash
    Preconditions: Dev server running on localhost:5173
    Steps:
      1. cd src/client
      2. bun run test:e2e -- e2e/smoke.spec.ts
      3. Assert: Exit code 0
    Expected Result: Smoke test passes
    Evidence: Test output log
  ```

  **Commit**: YES
  - Message: `chore(client): add Playwright E2E infrastructure`
  - Files: `src/client/playwright.config.ts`, `src/client/package.json`, `src/client/e2e/smoke.spec.ts`
  - Pre-commit: `cd src/client && bun run test:e2e`

---

- [x] 3a. Integration + E2E Tests

  **What to do**:
  - Update `AppContext` to use `useSSE` instead of `usePolling`
  - Write E2E test: file change → UI update within 500ms
  - Write E2E test: SSE failure → fallback to polling
  - Verify reduced motion behavior in E2E

  **Must NOT do**:
  - Do NOT remove `usePolling` hook (used by `useSSE` as fallback)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Integration work, straightforward hook swap + E2E tests
  - **Skills**: [`playwright`]
    - E2E tests with Playwright

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8)
  - **Blocks**: None (final integration)
  - **Blocked By**: Task 2, Task 3 (Playwright setup)

  **References**:

  **Pattern References**:
  - `src/client/src/store/AppContext.tsx:34-42` - Where to swap usePolling → useSSE
  - `src/client/e2e/smoke.spec.ts` - Playwright test pattern (from Task 3)

  **Acceptance Criteria**:

  **TDD Tests:**
  - [ ] E2E test file: `src/client/e2e/sse.spec.ts`
  - [ ] Test: File change triggers UI update within 500ms
  - [ ] Test: SSE failure falls back to polling
  - [ ] `cd src/client && bun run test:e2e` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Real-time update E2E
    Tool: Playwright (playwright skill)
    Preconditions: Full dev environment running (server + client)
    Steps:
      1. Navigate to: http://localhost:5173
      2. Wait for initial load (ActivityStream visible)
      3. Execute server-side: touch session file (via API or file system)
      4. Start timer
      5. Wait for new activity item in ActivityStream (max 1s)
      6. Assert: Item appeared within 500ms of file touch
      7. Screenshot: .sisyphus/evidence/task-3-realtime-update.png
    Expected Result: Update appears within 500ms
    Evidence: .sisyphus/evidence/task-3-realtime-update.png

  Scenario: Reduced motion E2E
    Tool: Playwright (playwright skill)
    Preconditions: Dev environment running
    Steps:
      1. page.emulateMedia({ reducedMotion: 'reduce' })
      2. Navigate to dashboard
      3. Trigger new activity item
      4. Assert: Item appears instantly (no animation delay)
      5. Assert: No CSS animation properties active
    Expected Result: Animations disabled with reduced motion
    Evidence: Screenshot showing instant state
  ```

  **Commit**: YES
  - Message: `feat(client): integrate SSE into AppContext + E2E tests`
  - Files: `src/client/src/store/AppContext.tsx`, `src/client/e2e/sse.spec.ts`
  - Pre-commit: `bun test && cd src/client && bun run test && cd src/client && bun run test:e2e`

---

- [x] 4. Install Motion + Shimmer CSS

  **What to do**:
  - Install `motion` package: `cd src/client && bun add motion`
  - Add shimmer keyframe animation to `src/client/src/styles/animations.css`
  - Add `.animate-shimmer` utility class
  - Update `LoadingSkeleton` component to use shimmer animation
  - Write visual test for shimmer appearance

  **Must NOT do**:
  - Do NOT install `framer-motion` (use `motion` instead)
  - Do NOT use JS-based shimmer animation

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Package install + CSS work, straightforward
  - **Skills**: []
    - Standard CSS/styling work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 5, 6, 8
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/client/src/styles/animations.css:1-67` - Existing animation patterns
  - `src/client/src/components/LoadingSkeleton.tsx:1-50` - Component to update
  - `src/client/tailwind.config.js:1-22` - Tailwind theme extension

  **External References**:
  - Motion install: `bun add motion` (NOT framer-motion)
  - Motion React import: `import { motion, AnimatePresence } from 'motion/react'`

  **Acceptance Criteria**:

  **TDD Tests:**
  - [ ] Test: LoadingSkeleton renders with shimmer class
  - [ ] `cd src/client && bun run test` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Shimmer animation visible during load
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. page.route('**/api/poll', route => route.abort()) // Block API to show loading
      2. Navigate to: http://localhost:5173
      3. Wait for: .animate-shimmer visible (timeout: 3s)
      4. Assert: Element has background animation (check computed style)
      5. Screenshot: .sisyphus/evidence/task-4-shimmer.png
    Expected Result: Shimmer skeleton visible with animated gradient
    Evidence: .sisyphus/evidence/task-4-shimmer.png
  ```

  **Commit**: YES
  - Message: `feat(client): add Motion package + shimmer animations`
  - Files: `src/client/package.json`, `src/client/src/styles/animations.css`, `src/client/src/components/LoadingSkeleton.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [x] 5. ActivityStream Animations

  **What to do**:
  - Wrap ActivityStream item list with `<AnimatePresence>`
  - Add `motion.div` wrapper to `ActivityRow` with enter/exit animations
  - Add `layout` prop to ActivityStream container for height transitions
  - Implement expand/collapse animation (smooth height change)
  - Increase default expanded height to `h-80 max-h-[50vh]`
  - Respect `prefers-reduced-motion` via Motion's built-in support
  - Animation duration max 200ms for items, 300ms for layout

  **Must NOT do**:
  - Do NOT use custom spring/easing configs (use Motion defaults)
  - Do NOT animate items longer than 300ms

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Animation work with Motion, visual polish
  - **Skills**: []
    - Standard React/Motion patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `src/client/src/components/ActivityStream.tsx:1-151` - Component to enhance
  - `src/client/src/components/ActivityRow.tsx:1-166` - Row component to wrap with motion

  **Test References**:
  - `src/client/src/components/__tests__/ActivityStream.test.tsx` - Existing tests to maintain

  **External References**:
  - AnimatePresence: `import { AnimatePresence, motion } from 'motion/react'`
  - Layout animation: `<motion.div layout>`

  **Acceptance Criteria**:

  **TDD Tests:**
  - [ ] Test: ActivityRow wrapped with motion.div
  - [ ] Test: AnimatePresence wraps item list
  - [ ] Test: Layout animation on height change
  - [ ] `cd src/client && bun run test src/components/__tests__/ActivityStream.test.tsx` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: New activity item animates in
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, dashboard loaded
    Steps:
      1. Navigate to: http://localhost:5173
      2. Wait for: ActivityStream visible
      3. Inject mock activity item via window.__testHelpers (or SSE mock)
      4. Wait for: New item appears in ActivityStream
      5. Assert: Item has opacity transition (0 → 1)
      6. Assert: Transition completes within 300ms
      7. Screenshot: .sisyphus/evidence/task-5-item-animation.png
    Expected Result: Item slides in with fade
    Evidence: .sisyphus/evidence/task-5-item-animation.png

  Scenario: Expand/collapse animates smoothly
    Tool: Playwright (playwright skill)
    Preconditions: Dashboard loaded, ActivityStream has items
    Steps:
      1. Click collapse button (chevron)
      2. Assert: Height animates (not instant jump)
      3. Click expand button
      4. Assert: Height animates back
      5. Assert: Final height is ~h-80 or max-h-[50vh]
    Expected Result: Smooth height transition
    Evidence: Screenshot sequence
  ```

  **Commit**: YES
  - Message: `feat(client): add Motion animations to ActivityStream`
  - Files: `src/client/src/components/ActivityStream.tsx`, `src/client/src/components/ActivityRow.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [x] 6. Enhanced Live Indicators

  **What to do**:
  - Enhance `StatusIndicator` in `LiveActivity.tsx` with more prominent pulse
  - Add glow effect to "working" status (expand existing `animate-badge-glow`)
  - Create "activity happening" state for LiveActivity header (pulsing dot when any agent working)
  - Ensure "Connected" indicator in header pulses when receiving SSE events

  **Must NOT do**:
  - Do NOT add sound or haptic feedback
  - Do NOT add toast notifications

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Visual polish, CSS animations
  - **Skills**: []
    - Standard CSS/styling work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 5)
  - **Blocks**: None
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `src/client/src/components/LiveActivity.tsx:66-94` - StatusIndicator component
  - `src/client/src/styles/animations.css:49-66` - Existing badge-glow animation
  - `src/client/src/components/LiveActivity.tsx:246-250` - "Connected" indicator

  **Acceptance Criteria**:

  **TDD Tests:**
  - [ ] Test: Working status has glow animation class
  - [ ] Test: Header shows activity indicator when agents working
  - [ ] `cd src/client && bun run test src/components/__tests__/LiveActivity.test.tsx` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Working agent has prominent pulse
    Tool: Playwright (playwright skill)
    Preconditions: Dashboard with active working session
    Steps:
      1. Navigate to dashboard
      2. Find working agent row (status = working)
      3. Assert: StatusIndicator has animate-spin + glow effect
      4. Assert: Animation is visually prominent (larger glow radius)
      5. Screenshot: .sisyphus/evidence/task-6-working-pulse.png
    Expected Result: Working status clearly visible with glow
    Evidence: .sisyphus/evidence/task-6-working-pulse.png
  ```

  **Commit**: YES
  - Message: `feat(client): enhance live indicators with prominent pulse`
  - Files: `src/client/src/components/LiveActivity.tsx`, `src/client/src/styles/animations.css`
  - Pre-commit: `cd src/client && bun run test`

---

- [x] 7. ActivityStream UX (Badge + Jump Button)

  **What to do**:
  - Add "New activity" badge to ActivityStream header when collapsed + new items arrive
  - Badge shows count (cap at "9+") and clears when expanded
  - Add floating "Jump to latest" button when user scrolls up in expanded ActivityStream
  - Track scroll position to determine if user is "at bottom"
  - Auto-scroll only when at bottom, otherwise show jump button

  **Must NOT do**:
  - Do NOT auto-scroll when user has scrolled up (reading history)
  - Do NOT add "mark all as read" feature

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: UI logic, scroll tracking, straightforward React state
  - **Skills**: []
    - Standard React patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 3, 8)
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/client/src/components/ActivityStream.tsx:55-86` - Header section with collapse button
  - `src/client/src/components/ActivityStream.tsx:131-146` - Scrollable content area

  **Acceptance Criteria**:

  **TDD Tests:**
  - [ ] Test: Badge appears when collapsed and new items arrive
  - [ ] Test: Badge clears when expanded
  - [ ] Test: Jump button appears when scrolled up + new items
  - [ ] Test: Jump button scrolls to bottom on click
  - [ ] `cd src/client && bun run test` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: New activity badge when collapsed
    Tool: Playwright (playwright skill)
    Preconditions: Dashboard loaded, ActivityStream collapsed
    Steps:
      1. Collapse ActivityStream (click chevron)
      2. Inject 3 new activity items
      3. Assert: Badge appears in header
      4. Assert: Badge shows "3" or similar count
      5. Click to expand
      6. Assert: Badge disappears
      7. Screenshot: .sisyphus/evidence/task-7-badge.png
    Expected Result: Badge shows new count, clears on expand
    Evidence: .sisyphus/evidence/task-7-badge.png

  Scenario: Jump to latest button
    Tool: Playwright (playwright skill)
    Preconditions: ActivityStream expanded with many items
    Steps:
      1. Scroll up in ActivityStream (away from bottom)
      2. Inject new activity item
      3. Assert: "Jump to latest" button appears
      4. Click the button
      5. Assert: Scrolled to bottom
      6. Assert: Button disappears
    Expected Result: Jump button works correctly
    Evidence: Screenshot sequence
  ```

  **Commit**: YES
  - Message: `feat(client): add new activity badge + jump to latest button`
  - Files: `src/client/src/components/ActivityStream.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [x] 8. Loading Skeleton Integration

  **What to do**:
  - Apply shimmer skeleton to `SessionListSkeleton`
  - Apply shimmer to ActivityStream empty/loading state
  - Apply shimmer to PlanProgress loading state
  - Ensure consistent shimmer animation across all loading states

  **Must NOT do**:
  - Do NOT create skeleton for every possible loading state (only the 3 above)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Apply existing shimmer pattern to components
  - **Skills**: []
    - Standard styling work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3/4 (with Tasks 3, 7)
  - **Blocks**: None
  - **Blocked By**: Tasks 4, 5

  **References**:

  **Pattern References**:
  - `src/client/src/components/LoadingSkeleton.tsx:27-49` - SessionListSkeleton to update
  - `src/client/src/components/ActivityStream.tsx:132-140` - Empty state to update
  - `src/client/src/components/PlanProgress.tsx:9-20` - No active plan state

  **Acceptance Criteria**:

  **TDD Tests:**
  - [ ] Test: SessionListSkeleton uses animate-shimmer
  - [ ] Test: ActivityStream loading state uses shimmer
  - [ ] Test: PlanProgress loading state uses shimmer
  - [ ] `cd src/client && bun run test` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All loading states have shimmer
    Tool: Playwright (playwright skill)
    Preconditions: Dev server, API blocked to show loading
    Steps:
      1. Block all API requests
      2. Navigate to dashboard
      3. Assert: SessionList shows shimmer skeleton
      4. Assert: ActivityStream area shows shimmer (if applicable)
      5. Screenshot: .sisyphus/evidence/task-8-shimmer-all.png
    Expected Result: Consistent shimmer across loading states
    Evidence: .sisyphus/evidence/task-8-shimmer-all.png
  ```

  **Commit**: YES
  - Message: `feat(client): apply shimmer skeletons to all loading states`
  - Files: `src/client/src/components/LoadingSkeleton.tsx`, `src/client/src/components/ActivityStream.tsx`, `src/client/src/components/PlanProgress.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(server): add SSE endpoint for real-time updates` | sse.ts, routes/index.ts, tests | `bun test` |
| 2 | `feat(client): add useSSE hook with polling fallback` | useSSE.ts, tests | `bun run test` |
| 3 | `chore(client): add Playwright E2E infrastructure` | playwright.config.ts, package.json, e2e/smoke.spec.ts | `bun run test:e2e` |
| 3a | `feat(client): integrate SSE into AppContext + E2E tests` | AppContext.tsx, e2e/sse.spec.ts | all tests |
| 4 | `feat(client): add Motion package + shimmer animations` | package.json, animations.css, LoadingSkeleton | `bun run test` |
| 5 | `feat(client): add Motion animations to ActivityStream` | ActivityStream.tsx, ActivityRow.tsx | `bun run test` |
| 6 | `feat(client): enhance live indicators with prominent pulse` | LiveActivity.tsx, animations.css | `bun run test` |
| 7 | `feat(client): add new activity badge + jump to latest button` | ActivityStream.tsx | `bun run test` |
| 8 | `feat(client): apply shimmer skeletons to all loading states` | multiple components | `bun run test` |

---

## Success Criteria

### Verification Commands
```bash
# Server tests pass
bun test

# Client tests pass
cd src/client && bun run test

# SSE responds
curl -s -N http://localhost:50234/api/sse -H "Accept: text/event-stream" | head -5

# E2E tests pass (after implementation)
# bun run test:e2e
```

### Final Checklist
- [x] All "Must Have" present:
  - [x] SSE endpoint working with heartbeat
  - [x] useSSE hook with polling fallback
  - [x] AnimatePresence on ActivityStream
  - [x] Shimmer skeletons on loading states
  - [x] Reduced motion support working
- [x] All "Must NOT Have" absent:
  - [x] No WebSocket implementation
  - [x] No SessionList animations
  - [x] No AgentTree animations
  - [x] No toast notifications
  - [x] No sound/haptic feedback
- [x] All tests pass
- [x] Dashboard feels "calm when idle, alive when active"
