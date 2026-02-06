# Activity Stream Redesign

## TL;DR

> **Quick Summary**: Redesign the Activity Stream from a noisy chronological log dump into a useful monitoring tool with burst-grouped events, visual hierarchy, smooth animations, and dual view modes (Stream + Swimlane).
> 
> **Deliverables**:
> - New `StreamEntry` data model (milestones + work bursts)
> - `groupIntoBursts()` pure function with full TDD coverage
> - Refactored `ActivityStream` with burst rendering, visual hierarchy tiers, and jank-free animations
> - Typed expansion (file paths, commands, patterns — not raw JSON)
> - Tab toggle: "Stream" (chronological bursts) vs "Agents" (per-agent swimlane)
> - Milestones-only mode toggle
> - Staggered reveal for batch arrivals
> 
> **Estimated Effort**: Large (1-2 days)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (types) → Task 2 (burst grouping) → Task 4 (ActivityStream refactor) → Task 5 (swimlane) → Task 7 (test migration)

---

## Context

### Original Request
The Activity Stream is a mess. Updates reorder entries, they appear janky. Expanding doesn't say much — just shows input. Updates come in bulk. The feature is not useful as-is.

### Interview Summary
**Key Discussions**:
- Full redesign scope (not incremental fixes)
- Aggressive burst grouping: all consecutive same-agent tool calls in one burst. Break only on agent change, error, or milestone (spawn/complete). No time cap, no size cap.
- Tab toggle for Stream vs per-agent Swimlane view
- Milestones-only mode toggle
- TDD approach using bun test (data layer) + vitest (components)

**Research Findings**:
- Oracle recommended two-level model (milestones + bursts), incremental merge, queued reveal, typed expansion
- `synthesizeActivityItems()` (67 lines) rebuilds entire array from scratch every poll — source of instability
- `AnimatePresence mode="popLayout"` + `layout` prop on every item = layout recalculation cascade = visible jank
- `ToolInput` type already exists with typed fields (`filePath`, `command`, `pattern`, etc.) but `ToolCallSummary.input` is typed as `object` instead
- Existing test suite: 3 test files (~600 lines total) must be preserved/migrated
- 50-call-per-session server cap stays as-is

### Metis Review
**Identified Gaps** (addressed):
- Burst grouping type: confirmed as same-agent (mixing tool types within burst, showing breakdown in summary)
- Burst key stability: use `items[0].id` as stable key (first item ID never changes as burst grows)
- Pending tool calls inside bursts: stay in burst, show "N running" indicator
- Agent filter chips: preserved in stream view, hidden in swimlane view
- Typed expansion limited to top ~8 known tools; others fall through to raw JSON under "Advanced"

---

## Work Objectives

### Core Objective
Transform the Activity Stream from a raw event log into a semantically grouped, visually hierarchical monitoring tool that shows what agents are *doing*, not individual API calls.

### Concrete Deliverables
- `src/shared/types/index.ts` — New `StreamEntry`, `BurstEntry`, `MilestoneEntry` types; fix `ToolCallSummary.input` type
- `src/shared/utils/burstGrouping.ts` — Pure function `groupIntoBursts(items: ActivityItem[]): StreamEntry[]`
- `src/shared/utils/__tests__/burstGrouping.test.ts` — Comprehensive TDD test suite
- `src/client/src/components/ActivityStream.tsx` — Refactored to consume `StreamEntry[]`, tab toggle, milestones toggle
- `src/client/src/components/ActivityRow.tsx` — Refactored for typed expansion + burst row rendering
- `src/client/src/components/BurstRow.tsx` — New component for collapsed/expandable work bursts
- `src/client/src/components/MilestoneRow.tsx` — New component for visually prominent milestone events
- `src/client/src/components/AgentSwimlane.tsx` — New swimlane view component
- `src/client/src/App.tsx` — Updated data flow: `synthesizeActivityItems()` → `groupIntoBursts()` → `ActivityStream`

### Definition of Done
- [x] `bun test src/shared/utils/__tests__/burstGrouping.test.ts` → all pass
- [x] `cd src/client && bun run test -- --run` → all pass (including migrated tests)
- [x] `bun run tsc -b` → no new type errors
- [x] Activity Stream renders grouped bursts, not flat events
- [x] No visible jank/reordering when new data arrives
- [x] Expanding a burst shows individual tool calls with typed fields
- [x] Tab toggle switches between Stream and Agent Swimlane views
- [x] Milestones-only toggle hides routine bursts

### Must Have
- Burst grouping by agent (break on agent change, error, milestone)
- Visual hierarchy: milestones are visually prominent, bursts are compact, burst internals are muted
- Stable rendering: no layout reordering on poll updates
- Typed expansion for read/write/edit/grep/glob/bash/fetch/search tools
- "Stream" / "Agents" tab toggle
- Milestones-only mode

### Must NOT Have (Guardrails)
- ❌ No server-side changes (`src/server/**` untouched)
- ❌ No new polling endpoints or API changes
- ❌ No virtual scrolling (burst grouping makes it unnecessary)
- ❌ No configurable grouping thresholds (aggressive grouping, period)
- ❌ No swimlane time ruler / Gantt-style timeline axis
- ❌ No burst analytics (average duration, frequency)
- ❌ No drag-to-resize swimlane columns
- ❌ No search within bursts
- ❌ No new animation libraries (stay with motion/react)
- ❌ No persisted expansion state across polls
- ❌ Don't change `synthesizeActivityItems()` — it stays as-is, new function wraps it
- ❌ Don't increase 50-call-per-session server cap

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks MUST be verifiable WITHOUT any human action.

### Test Decision
- **Infrastructure exists**: YES (bun test + vitest)
- **Automated tests**: TDD (RED-GREEN-REFACTOR)
- **Framework**: bun test (data layer in `src/shared/`), vitest with jsdom (components in `src/client/`)

### TDD Workflow Per Task

**Task Structure:**
1. **RED**: Write failing test first
   - Test file created, implementation doesn't exist
   - Command: `bun test [file]` or `cd src/client && bun run test -- --run [file]`
   - Expected: FAIL
2. **GREEN**: Implement minimum code to pass
   - Expected: PASS
3. **REFACTOR**: Clean up while keeping green
   - Expected: PASS (still)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

**Verification Tool by Deliverable Type:**

| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| Data layer (burst grouping) | Bash (bun test) | Run tests, assert pass |
| Components | Bash (vitest) | Run tests, assert pass |
| UI rendering | Playwright | Navigate, interact, assert DOM, screenshot |
| Type safety | Bash (tsc) | Run type check, assert no errors |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Define new types (StreamEntry, BurstEntry, MilestoneEntry)
├── Task 3: Typed expansion for ActivityRow (independent — works on existing data)
└── (Task 1 is tiny, likely done before Task 2 starts)

Wave 2 (After Task 1 types exist):
├── Task 2: Burst grouping function (TDD) — depends on Task 1 types
├── Task 3 continues if not done

Wave 3 (After Task 2 burst logic works):
├── Task 4: ActivityStream refactor + animation fix
├── Task 5: AgentSwimlane view (can start once ActivityStream has tab structure)

Wave 4 (After Tasks 4+5):
├── Task 6: Milestones-only mode toggle
├── Task 7: Migrate existing tests
└── Task 8: Integration wiring in App.tsx + final QA
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 (types) | None | 2, 4, 5, 6 | 3 |
| 2 (burst grouping) | 1 | 4, 8 | 3 |
| 3 (typed expansion) | None | 7 | 1, 2 |
| 4 (ActivityStream refactor) | 1, 2 | 5, 6, 7, 8 | None |
| 5 (swimlane) | 4 | 8 | 6 |
| 6 (milestones toggle) | 4 | 8 | 5 |
| 7 (test migration) | 3, 4 | 8 | 5, 6 |
| 8 (integration + QA) | 2, 4, 5, 6, 7 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 3 | delegate_task(category="quick", ...) — small focused changes |
| 2 | 2 | delegate_task(category="deep", ...) — algorithmic, needs TDD precision |
| 3 | 4, 5 | delegate_task(category="visual-engineering", ...) — UI refactoring |
| 4 | 6, 7, 8 | delegate_task(category="unspecified-low", ...) — polish + wiring |

---

## TODOs

- [x] 1. Define `StreamEntry` types and fix `ToolCallSummary.input` type

  **What to do**:
  - Add new types to `src/shared/types/index.ts`:
    - `BurstEntry`: `{ id: string; type: "burst"; agentName: string; items: ToolCallActivity[]; toolBreakdown: Record<string, number>; durationMs: number; firstTimestamp: Date; lastTimestamp: Date; pendingCount: number; errorCount: number; }`
    - `MilestoneEntry`: `{ id: string; type: "milestone"; item: AgentSpawnActivity | AgentCompleteActivity | ToolCallActivity; }` (ToolCallActivity only when `state === "error"`)
    - `StreamEntry = BurstEntry | MilestoneEntry`
  - Fix `ToolCallSummary.input` type from `object` to `ToolInput` (line 129)
  - Export all new types

  **TDD**:
  - RED: Write type assertion test in `src/shared/utils/__tests__/burstGrouping.test.ts` that imports `StreamEntry` and asserts type shape
  - GREEN: Add types to `src/shared/types/index.ts`
  - REFACTOR: Ensure `bun run tsc -b` passes

  **Must NOT do**:
  - Don't modify `ActivityItem` union — it stays as-is
  - Don't modify `synthesizeActivityItems`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, focused type-definition task with minimal code changes
  - **Skills**: [`git-master`]
    - `git-master`: For clean atomic commit of type changes

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Tasks 2, 4, 5, 6
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/shared/types/index.ts:180-183` — Existing `ActivityItem` union pattern to follow for `StreamEntry`
  - `src/shared/types/index.ts:142-175` — `ToolCallActivity`, `AgentSpawnActivity`, `AgentCompleteActivity` shapes that `StreamEntry` wraps

  **API/Type References**:
  - `src/shared/types/index.ts:71-78` — `ToolInput` interface (the correct type for `ToolCallSummary.input`)
  - `src/shared/types/index.ts:124-132` — `ToolCallSummary` where `input: object` needs to become `input: ToolInput`

  **Acceptance Criteria**:

  - [ ] `StreamEntry`, `BurstEntry`, `MilestoneEntry` types exported from `src/shared/types/index.ts`
  - [ ] `ToolCallSummary.input` typed as `ToolInput` (not `object`)
  - [ ] `bun run tsc -b` → no new errors
  - [ ] Existing tests unaffected: `bun test src/shared/utils/__tests__/activityUtils.test.ts` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Type definitions compile cleanly
    Tool: Bash (bun)
    Preconditions: None
    Steps:
      1. Run: bun run tsc -b
      2. Assert: exit code 0, no new errors related to StreamEntry/BurstEntry/MilestoneEntry
    Expected Result: Clean compilation
    Evidence: Terminal output captured

  Scenario: Existing tests still pass
    Tool: Bash (bun)
    Preconditions: None
    Steps:
      1. Run: bun test src/shared/utils/__tests__/activityUtils.test.ts
      2. Assert: all tests pass, 0 failures
    Expected Result: No regressions
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(types): add StreamEntry types for burst-grouped activity stream`
  - Files: `src/shared/types/index.ts`
  - Pre-commit: `bun run tsc -b`

---

- [x] 2. Implement `groupIntoBursts()` function (TDD)

  **What to do**:
  - Create `src/shared/utils/burstGrouping.ts` with pure function `groupIntoBursts(items: ActivityItem[]): StreamEntry[]`
  - Grouping rules:
    - Walk items chronologically
    - **Milestones**: `agent-spawn`, `agent-complete`, and `tool-call` with `state === "error"` → emit as `MilestoneEntry`
    - **Bursts**: Consecutive `tool-call` items from same `agentName` (that aren't errors) → group into `BurstEntry`
    - Break current burst when: agent changes, milestone encountered, error tool call encountered
    - Single tool call = burst with 1 item (degenerates gracefully)
  - Burst fields:
    - `id`: first item's ID (stable key)
    - `toolBreakdown`: count of each tool name (`{ read: 5, edit: 1, grep: 2 }`)
    - `durationMs`: `lastTimestamp - firstTimestamp`
    - `pendingCount`: number of items with `state === "pending"`
    - `errorCount`: number of items with `state === "error"` (within burst — not milestone-level errors)

  **TDD test cases** (write tests FIRST in `src/shared/utils/__tests__/burstGrouping.test.ts`):
  1. Empty input → empty output
  2. Single tool call → 1 burst with 1 item
  3. 10 consecutive reads from same agent → 1 burst, `toolBreakdown: { read: 10 }`, `items.length === 10`
  4. Agent A reads 5, Agent B reads 3 → 2 bursts (agent break)
  5. Agent A reads 3, Agent A gets error → 1 burst (3 reads) + 1 milestone (error)
  6. Agent spawn in middle of tool calls → burst, milestone, burst
  7. Agent complete in middle → same pattern
  8. Mixed tools same agent: read 3, edit 1, grep 2 → 1 burst, `toolBreakdown: { read: 3, edit: 1, grep: 2 }`
  9. Pending tool calls included in burst, `pendingCount` reflects count
  10. Duration calculated correctly from first to last timestamp
  11. Items within burst maintain chronological order

  **Must NOT do**:
  - Don't modify `synthesizeActivityItems()` — this is a separate function
  - Don't handle animation or rendering concerns
  - Don't include React-specific logic

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Algorithmic grouping logic requiring precise TDD, edge case handling, and deterministic behavior
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit after tests pass

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Task 1 types)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 4, 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/shared/utils/activityUtils.ts:1-66` — `synthesizeActivityItems()` — the upstream function whose output is our input. Shows how `ActivityItem[]` is structured chronologically.
  - `src/shared/utils/__tests__/activityUtils.test.ts:1-104` — Test pattern to follow: `describe/it` structure, mock `ActivitySession` objects, type assertions

  **API/Type References**:
  - `src/shared/types/index.ts:142-183` — `ActivityItem` union (our input type)
  - `src/shared/types/index.ts` — New `StreamEntry` types (our output type, from Task 1)

  **Acceptance Criteria**:

  - [ ] Test file created: `src/shared/utils/__tests__/burstGrouping.test.ts` (11+ test cases)
  - [ ] `bun test src/shared/utils/__tests__/burstGrouping.test.ts` → PASS (all 11+ tests, 0 failures)
  - [ ] Function exported from `src/shared/utils/burstGrouping.ts`
  - [ ] `bun run tsc -b` → no errors

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All burst grouping tests pass
    Tool: Bash (bun)
    Preconditions: Task 1 types exist
    Steps:
      1. Run: bun test src/shared/utils/__tests__/burstGrouping.test.ts
      2. Assert: 11+ tests pass, 0 failures, 0 skipped
    Expected Result: Full test coverage for grouping logic
    Evidence: Test output captured

  Scenario: Grouping produces correct structure for mixed input
    Tool: Bash (bun)
    Preconditions: burstGrouping.ts implemented
    Steps:
      1. Run: bun test src/shared/utils/__tests__/burstGrouping.test.ts --test-name-pattern "mixed"
      2. Assert: mixed tool types produce single burst with toolBreakdown
    Expected Result: Tool breakdown correctly tallied
    Evidence: Test output captured

  Scenario: Type check passes
    Tool: Bash (bun)
    Preconditions: burstGrouping.ts implemented
    Steps:
      1. Run: bun run tsc -b
      2. Assert: exit code 0
    Expected Result: No type errors
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(activity): add burst grouping logic for activity stream redesign`
  - Files: `src/shared/utils/burstGrouping.ts`, `src/shared/utils/__tests__/burstGrouping.test.ts`
  - Pre-commit: `bun test src/shared/utils/__tests__/burstGrouping.test.ts`

---

- [x] 3. Redesign tool call expansion with typed fields

  **What to do**:
  - Refactor `renderDetails()` in `src/client/src/components/ActivityRow.tsx` (lines 95-115)
  - Instead of raw `JSON.stringify(item.input, null, 2)`, render typed fields based on tool name:
    - **read / mcp_read**: Show `filePath` field prominently with file icon
    - **write / mcp_write / edit / mcp_edit**: Show `filePath` + operation summary
    - **grep / mcp_grep / search**: Show `pattern` + optional `path`/`include`
    - **glob / mcp_glob**: Show `pattern` + optional `path`
    - **bash / mcp_bash**: Show `command` in monospace code block + `description` if present
    - **webfetch / mcp_webfetch**: Show `url`
    - **All other tools**: Show raw JSON under collapsed "Advanced" disclosure
  - Create a helper `getTypedFields(toolName: string, input: ToolInput): TypedField[]` that extracts display-worthy fields
  - Keep raw JSON available under a collapsed "Advanced" section for debugging

  **TDD**:
  - RED: Write vitest component test that renders `<ActivityRow>` with a `read` tool call and asserts `filePath` is visible (not raw JSON)
  - GREEN: Implement typed rendering
  - REFACTOR: Extract `getTypedFields` helper for reuse in `BurstRow`

  **Must NOT do**:
  - Don't change the ActivityRow component API/props
  - Don't modify the data layer
  - Don't try to parse every possible tool — limit to top 8 listed above

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused component refactor with clear input/output
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: For clean, readable field rendering with proper styling

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 7 (test migration)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/client/src/components/ActivityRow.tsx:95-115` — Current `renderDetails()` to replace (raw JSON dump)
  - `src/client/src/components/ActivityRow.tsx:29-36` — `getToolIcon()` — existing tool name matching pattern to follow for typed fields

  **API/Type References**:
  - `src/shared/types/index.ts:71-78` — `ToolInput` interface with known fields: `filePath`, `command`, `pattern`, `url`, `query`
  - `src/shared/types/index.ts:142-152` — `ToolCallActivity` with `toolName`, `input`, `summary`

  **Test References**:
  - `src/client/src/components/__tests__/ActivityStream.test.tsx` — Existing component test patterns (vitest + @testing-library/react)

  **Acceptance Criteria**:

  - [ ] Expanding a `read` tool call shows `filePath` value as readable text, not JSON
  - [ ] Expanding a `bash` tool call shows `command` in monospace block
  - [ ] Expanding an unknown tool shows "Advanced" disclosure with raw JSON
  - [ ] `cd src/client && bun run test -- --run` → PASS
  - [ ] `bun run tsc -b` → no errors

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Typed expansion for read tool
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running on localhost:5173, active session with read tool calls
    Steps:
      1. Navigate to: http://localhost:5173
      2. Wait for: Activity Stream to populate (timeout: 10s)
      3. Find a row containing "read" tool name
      4. Click the row to expand
      5. Assert: expanded section contains a readable file path (not wrapped in JSON braces)
      6. Assert: no `{` or `"filePath":` visible in the primary expansion area
      7. Screenshot: .sisyphus/evidence/task-3-typed-expansion-read.png
    Expected Result: Clean, readable file path display
    Evidence: .sisyphus/evidence/task-3-typed-expansion-read.png

  Scenario: Fallback to Advanced JSON for unknown tool
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, activity with non-standard tool calls
    Steps:
      1. Navigate to: http://localhost:5173
      2. Find a row with a less common tool name
      3. Click to expand
      4. Assert: "Advanced" or disclosure toggle visible
      5. Click disclosure → Assert raw JSON visible
      6. Screenshot: .sisyphus/evidence/task-3-advanced-json-fallback.png
    Expected Result: Raw JSON hidden behind disclosure by default
    Evidence: .sisyphus/evidence/task-3-advanced-json-fallback.png

  Scenario: Component tests pass
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: cd src/client && bun run test -- --run
      2. Assert: 0 failures
    Expected Result: All tests pass
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `feat(activity): typed tool expansion replacing raw JSON dump`
  - Files: `src/client/src/components/ActivityRow.tsx`
  - Pre-commit: `cd src/client && bun run test -- --run`

---

- [x] 4. Refactor ActivityStream for burst rendering + fix animation jank

  **What to do**:
  - **Data model change**: `ActivityStream` now accepts `StreamEntry[]` instead of `ActivityItem[]`
  - **Create `BurstRow` component** (`src/client/src/components/BurstRow.tsx`):
    - Collapsed state shows: timestamp, agent dot, tool breakdown summary (e.g., "read ×5, edit ×1"), duration, pending indicator, expand chevron
    - Expanded state shows: individual tool calls within burst as indented sub-rows (using `ActivityRow`)
    - Agent color dot uses `getAgentColor(burst.agentName)`
  - **Create `MilestoneRow` component** (`src/client/src/components/MilestoneRow.tsx`):
    - Visually prominent: slightly larger text, distinct background tint, stronger icon
    - Agent spawn: shows parent → child with colored agent names
    - Agent complete: shows agent name, status, duration
    - Error tool call: red accent, error message preview
  - **Fix animation jank**:
    - REMOVE `layout` prop from `<motion.div>` wrapping each stream entry (line 220 of current ActivityStream.tsx)
    - REMOVE `AnimatePresence mode="popLayout"` — change to `mode="sync"` or remove mode
    - Keep `initial/animate/exit` for enter/exit animations (opacity + small y translation)
    - Add staggered reveal: new items from a batch get sequential `transition.delay` (50ms per item within batch)
  - **Tab toggle**: Add "Stream" / "Agents" tabs at top of panel (below header, above filter chips)
    - "Stream" tab renders the burst-grouped chronological view (this task)
    - "Agents" tab placeholder for Task 5
  - **Preserve agent filter chips**: Keep existing filter bar in "Stream" view

  **TDD**:
  - RED: Write vitest tests for `BurstRow` (renders summary, expands to show items) and `MilestoneRow` (renders with visual prominence)
  - GREEN: Implement components
  - REFACTOR: Extract shared styles/utilities

  **Must NOT do**:
  - Don't implement the swimlane view (Task 5)
  - Don't implement milestones-only toggle (Task 6)
  - Don't add virtual scrolling
  - Don't change the data fetching/polling layer

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Heavy UI component work with animation tuning and visual hierarchy
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: For polished component design matching existing dark theme

  **Parallelization**:
  - **Can Run In Parallel**: NO (needs Tasks 1+2)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 5, 6, 7, 8
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/client/src/components/ActivityStream.tsx:1-247` — Current component to refactor. Key areas: line 212-225 (AnimatePresence + layout props to remove), line 100-103 (panel height), line 149-161 (collapsed state summary)
  - `src/client/src/components/ActivityRow.tsx:1-177` — Individual row rendering pattern to follow for `BurstRow` and `MilestoneRow`
  - `src/client/src/components/ActivityRow.tsx:29-36` — `getToolIcon()` — reuse for tool icons in burst breakdown

  **API/Type References**:
  - `src/shared/types/index.ts` — New `StreamEntry`, `BurstEntry`, `MilestoneEntry` types (from Task 1)
  - `src/shared/utils/burstGrouping.ts` — `groupIntoBursts()` function (from Task 2)

  **Styling References**:
  - `src/client/src/styles/index.css` — Tailwind theme: `bg-surface` (#161b22), `bg-background` (#0d1117), `text-accent` (#58a6ff), `border-border`
  - `src/client/src/utils/agentColors.ts` — `getAgentColor()` for agent color dots

  **Acceptance Criteria**:

  - [ ] `BurstRow` component: collapsed shows "read ×5, edit ×1 (12s)", expanded shows individual calls
  - [ ] `MilestoneRow` component: visually distinct from burst rows (larger, accent background)
  - [ ] No `layout` prop on stream entry wrappers
  - [ ] No `AnimatePresence mode="popLayout"` in stream
  - [ ] New items animate in with staggered delay (no bulk flash)
  - [ ] Tab UI with "Stream" and "Agents" tabs visible (Agents tab can be placeholder)
  - [ ] `cd src/client && bun run test -- --run` → PASS
  - [ ] `bun run tsc -b` → no errors

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Burst rows render grouped tool calls
    Tool: Playwright (playwright skill)
    Preconditions: Dev server on localhost:5173, active session with multiple tool calls
    Steps:
      1. Navigate to: http://localhost:5173
      2. Wait for: Activity Stream entries to appear (timeout: 15s)
      3. Assert: Fewer rows than raw tool call count (burst grouping working)
      4. Find a burst row containing "×" in text (e.g., "read ×5")
      5. Assert: burst row shows agent color dot, timestamp, tool breakdown summary
      6. Click burst row to expand
      7. Assert: individual tool calls appear as indented sub-rows
      8. Screenshot: .sisyphus/evidence/task-4-burst-expanded.png
    Expected Result: Grouped activity with expandable detail
    Evidence: .sisyphus/evidence/task-4-burst-expanded.png

  Scenario: Milestone rows are visually distinct
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, session with agent spawns
    Steps:
      1. Navigate to: http://localhost:5173
      2. Wait for: Activity Stream entries
      3. Find an agent spawn or complete row
      4. Assert: milestone row has different visual treatment (background color, larger text)
      5. Assert: milestone row does NOT have expand chevron (unless it's an error)
      6. Screenshot: .sisyphus/evidence/task-4-milestone-visual.png
    Expected Result: Clear visual distinction between milestones and routine bursts
    Evidence: .sisyphus/evidence/task-4-milestone-visual.png

  Scenario: No reorder jank on data update
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, active session generating tool calls
    Steps:
      1. Navigate to: http://localhost:5173
      2. Wait 10 seconds (5 polling cycles)
      3. Observe: new items appear at bottom with smooth entry animation
      4. Assert: existing rows do NOT shift position or flicker
      5. Screenshot before/after: .sisyphus/evidence/task-4-no-jank-before.png, task-4-no-jank-after.png
    Expected Result: Smooth additions without reordering
    Evidence: .sisyphus/evidence/task-4-no-jank-*.png

  Scenario: Tab toggle UI present
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Navigate to: http://localhost:5173
      2. Assert: two tab buttons visible in activity panel: "Stream" and "Agents"
      3. Assert: "Stream" tab is active by default
      4. Click "Agents" tab
      5. Assert: tab switches (placeholder content OK for now)
      6. Click "Stream" tab
      7. Assert: burst-grouped stream view reappears
      8. Screenshot: .sisyphus/evidence/task-4-tab-toggle.png
    Expected Result: Tab toggle functional
    Evidence: .sisyphus/evidence/task-4-tab-toggle.png
  ```

  **Commit**: YES
  - Message: `feat(activity): burst rendering, visual hierarchy, and animation fix`
  - Files: `src/client/src/components/ActivityStream.tsx`, `src/client/src/components/BurstRow.tsx`, `src/client/src/components/MilestoneRow.tsx`
  - Pre-commit: `cd src/client && bun run test -- --run`

---

- [x] 5. Implement Agent Swimlane view

  **What to do**:
  - Create `src/client/src/components/AgentSwimlane.tsx`
  - Layout: Each active agent gets a vertical column/lane. Within each lane, that agent's events shown chronologically.
  - Agent header: agent name, color dot, status (working/completed), duration
  - Lane content: Simplified event rows (tool name + summary, no expand)
  - Short-lived agents: completed agent lanes show grayed out / collapsed after completion
  - Max visible lanes: 4-5 side-by-side, horizontal scroll for overflow
  - Connect to "Agents" tab in ActivityStream (Task 4 created the tab shell)
  - Data: Receives same `StreamEntry[]` but renders grouped by `agentName` instead of chronologically

  **TDD**:
  - RED: Write vitest test that renders AgentSwimlane with 3 agents' data, asserts 3 columns present
  - GREEN: Implement layout
  - REFACTOR: Polish column sizing

  **Must NOT do**:
  - No time ruler / Gantt timeline axis
  - No drag-to-resize columns
  - No swimlane-specific filtering (agent filters from stream view are hidden here)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Layout-heavy UI work with responsive column design
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: For clean column layout matching dark theme

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 4's tab structure exists)
  - **Parallel Group**: Wave 3-4 (with Task 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `src/client/src/components/ActivityStream.tsx` — Tab toggle shell from Task 4 (where swimlane renders)
  - `src/client/src/components/BurstRow.tsx` — Burst rendering pattern (from Task 4) to simplify for lane events
  - `src/client/src/utils/agentColors.ts` — `getAgentColor()` for lane headers

  **API/Type References**:
  - `src/shared/types/index.ts` — `StreamEntry`, `BurstEntry`, `MilestoneEntry`
  - `src/shared/types/index.ts:101-107` — `AgentInfo` for agent metadata

  **Acceptance Criteria**:

  - [ ] `AgentSwimlane` component renders one column per agent
  - [ ] Clicking "Agents" tab shows swimlane view
  - [ ] Completed agents show grayed/collapsed lanes
  - [ ] Horizontal scroll for 5+ agents
  - [ ] `cd src/client && bun run test -- --run` → PASS
  - [ ] `bun run tsc -b` → no errors

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Swimlane shows per-agent columns
    Tool: Playwright (playwright skill)
    Preconditions: Dev server on localhost:5173, session with 2+ agents
    Steps:
      1. Navigate to: http://localhost:5173
      2. Click "Agents" tab in activity panel
      3. Assert: Multiple vertical columns visible, each with an agent name header
      4. Assert: Each column has agent-specific color dot in header
      5. Assert: Events within each column belong to that agent only
      6. Screenshot: .sisyphus/evidence/task-5-swimlane.png
    Expected Result: Per-agent swimlane layout
    Evidence: .sisyphus/evidence/task-5-swimlane.png

  Scenario: Completed agent lanes are visually dimmed
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, session where some agents have completed
    Steps:
      1. Navigate to: http://localhost:5173
      2. Click "Agents" tab
      3. Find a completed agent column
      4. Assert: column has reduced opacity or grayed styling
      5. Screenshot: .sisyphus/evidence/task-5-completed-agent.png
    Expected Result: Visual distinction for completed agents
    Evidence: .sisyphus/evidence/task-5-completed-agent.png
  ```

  **Commit**: YES
  - Message: `feat(activity): per-agent swimlane view with tab toggle`
  - Files: `src/client/src/components/AgentSwimlane.tsx`, `src/client/src/components/ActivityStream.tsx` (tab wiring)
  - Pre-commit: `cd src/client && bun run test -- --run`

---

- [x] 6. Add milestones-only mode toggle

  **What to do**:
  - Add toggle button/switch in ActivityStream header (next to existing filter/collapse controls)
  - When ON: hide all `BurstEntry` items, show only `MilestoneEntry` items
  - Visual: small icon button (e.g., diamond/star icon from lucide) with tooltip "Milestones only"
  - Toggle state is local component state (not persisted)
  - Works in "Stream" tab only (hidden in "Agents" tab)

  **TDD**:
  - RED: Write vitest test that renders ActivityStream with burst+milestone entries, clicks milestones toggle, asserts bursts hidden
  - GREEN: Implement toggle filter
  - REFACTOR: Polish toggle styling

  **Must NOT do**:
  - Don't persist toggle state to URL or localStorage
  - Don't affect swimlane view

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small UI addition — one toggle button with filter logic
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: For consistent button styling

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 5)
  - **Parallel Group**: Wave 3-4 (with Task 5)
  - **Blocks**: Task 8
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `src/client/src/components/ActivityStream.tsx:86-94` — Existing `toggleAgent` filter pattern to follow
  - `src/client/src/components/ActivityStream.tsx:126-136` — Existing "Clear filters" button styling

  **API/Type References**:
  - `src/shared/types/index.ts` — `StreamEntry` union, `BurstEntry.type === "burst"`, `MilestoneEntry.type === "milestone"`

  **Acceptance Criteria**:

  - [ ] Toggle button visible in ActivityStream header
  - [ ] When toggled ON: only milestones (spawn/complete/error) shown
  - [ ] When toggled OFF: full stream with bursts restored
  - [ ] Toggle hidden when "Agents" tab is active
  - [ ] `cd src/client && bun run test -- --run` → PASS

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Milestones-only mode filters bursts
    Tool: Playwright (playwright skill)
    Preconditions: Dev server on localhost:5173, session with tool calls and agent events
    Steps:
      1. Navigate to: http://localhost:5173
      2. Wait for Activity Stream entries
      3. Count total visible rows (N)
      4. Click milestones-only toggle
      5. Count visible rows (M)
      6. Assert: M < N (bursts filtered out)
      7. Assert: remaining rows are milestones (spawn/complete/error)
      8. Click toggle again
      9. Assert: row count returns to N
      10. Screenshot: .sisyphus/evidence/task-6-milestones-only.png
    Expected Result: Toggle filters out routine bursts
    Evidence: .sisyphus/evidence/task-6-milestones-only.png
  ```

  **Commit**: YES
  - Message: `feat(activity): milestones-only mode toggle`
  - Files: `src/client/src/components/ActivityStream.tsx`
  - Pre-commit: `cd src/client && bun run test -- --run`

---

- [x] 7. Migrate existing ActivityStream tests

  **What to do**:
  - Update `src/client/src/components/__tests__/ActivityStream.test.tsx` to work with new `StreamEntry[]` props
  - Update `src/client/src/components/__tests__/ActivityStreamUX.test.tsx` to work with burst-grouped rendering
  - Preserve all existing test intent — adapt assertions to new component structure
  - Add new test cases for:
    - Burst row rendering (collapsed summary, expanded sub-rows)
    - Milestone visual distinction
    - Tab toggle between Stream and Agents views
    - Milestones-only toggle

  **Must NOT do**:
  - Don't delete existing tests without replacement
  - Don't reduce overall test coverage

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Test migration is mechanical — adapting existing patterns to new component API
  - **Skills**: [`git-master`]
    - `git-master`: Clean commit of migrated tests

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 5, 6)
  - **Parallel Group**: Wave 3-4
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 3, 4

  **References**:

  **Pattern References**:
  - `src/client/src/components/__tests__/ActivityStream.test.tsx` — Existing tests to migrate
  - `src/client/src/components/__tests__/ActivityStreamUX.test.tsx` — Existing UX tests to migrate

  **Test References**:
  - `src/client/src/components/__tests__/ActivityStream.test.tsx` — vitest + @testing-library/react patterns, mock data shapes

  **Acceptance Criteria**:

  - [ ] All existing test intent preserved (no test cases deleted without replacement)
  - [ ] New test cases added for burst rendering, milestone distinction, tab toggle, milestones toggle
  - [ ] `cd src/client && bun run test -- --run` → PASS (0 failures)
  - [ ] Test count ≥ previous test count

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All client tests pass after migration
    Tool: Bash
    Preconditions: Tasks 3, 4, 5, 6 complete
    Steps:
      1. Run: cd src/client && bun run test -- --run
      2. Assert: 0 failures, 0 errors
      3. Assert: test count >= previous count (no tests lost)
    Expected Result: Full test suite green
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `test(activity): migrate and extend ActivityStream tests for burst model`
  - Files: `src/client/src/components/__tests__/ActivityStream.test.tsx`, `src/client/src/components/__tests__/ActivityStreamUX.test.tsx`
  - Pre-commit: `cd src/client && bun run test -- --run`

---

- [x] 8. Wire integration in App.tsx + final QA

  **What to do**:
  - Update `src/client/src/App.tsx` data flow:
    - Current: `synthesizeActivityItems(activitySessions)` → `ActivityItem[]` → `<ActivityStream items={...}>`
    - New: `synthesizeActivityItems(activitySessions)` → `groupIntoBursts(items)` → `StreamEntry[]` → `<ActivityStream entries={...}>`
  - Import `groupIntoBursts` from `@shared/utils/burstGrouping`
  - Update `ActivityStream` props: rename `items` to `entries` (type: `StreamEntry[]`)
  - Run full test suite and type check
  - Final integration verification via Playwright

  **Must NOT do**:
  - Don't change the polling interval or data fetching
  - Don't modify server code
  - Don't add new endpoints

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Small wiring change in App.tsx + final verification pass
  - **Skills**: [`frontend-ui-ux`, `playwright`]
    - `frontend-ui-ux`: For verifying visual integration
    - `playwright`: For comprehensive E2E QA

  **Parallelization**:
  - **Can Run In Parallel**: NO (final integration task)
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 2, 4, 5, 6, 7

  **References**:

  **Pattern References**:
  - `src/client/src/App.tsx:38` — Current `synthesizeActivityItems` call to extend with `groupIntoBursts`
  - `src/client/src/App.tsx:139-141` — Current `<ActivityStream items={activityItems}>` to update props

  **API/Type References**:
  - `src/shared/utils/burstGrouping.ts` — `groupIntoBursts()` (from Task 2)
  - `src/shared/types/index.ts` — `StreamEntry[]` type

  **Acceptance Criteria**:

  - [ ] `App.tsx` chains `synthesizeActivityItems()` → `groupIntoBursts()` → `<ActivityStream entries={...}>`
  - [ ] `bun test` → all server tests pass
  - [ ] `cd src/client && bun run test -- --run` → all client tests pass
  - [ ] `bun run tsc -b` → no type errors
  - [ ] Full E2E: activity stream renders burst-grouped entries in browser

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Full integration - burst-grouped activity stream
    Tool: Playwright (playwright skill)
    Preconditions: Dev server on localhost:5173, active coding session
    Steps:
      1. Navigate to: http://localhost:5173
      2. Wait for: Activity Stream entries (timeout: 15s)
      3. Assert: Burst rows visible with "×N" counts
      4. Assert: Milestone rows visually distinct
      5. Click a burst row → Assert sub-rows appear
      6. Click a tool call within burst → Assert typed expansion (file path, not JSON)
      7. Click "Agents" tab → Assert swimlane columns
      8. Click "Stream" tab → Assert chronological view
      9. Click milestones-only toggle → Assert bursts hidden
      10. Wait 10 seconds → Assert no reorder jank on updates
      11. Screenshot: .sisyphus/evidence/task-8-final-integration.png
    Expected Result: Complete redesigned activity stream working end-to-end
    Evidence: .sisyphus/evidence/task-8-final-integration.png

  Scenario: All tests pass (full suite)
    Tool: Bash
    Preconditions: All previous tasks complete
    Steps:
      1. Run: bun test
      2. Assert: 0 failures
      3. Run: cd src/client && bun run test -- --run
      4. Assert: 0 failures
      5. Run: bun run tsc -b
      6. Assert: exit code 0
    Expected Result: Green across all test suites and type checking
    Evidence: Terminal output captured

  Scenario: No regressions in other components
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Navigate to: http://localhost:5173
      2. Assert: SessionList sidebar renders sessions
      3. Assert: Header with OCWatch title visible
      4. Assert: LiveActivity area renders (if agents active)
      5. Assert: PlanProgress shows (if boulder.json exists)
      6. Screenshot: .sisyphus/evidence/task-8-no-regression.png
    Expected Result: All other dashboard components unaffected
    Evidence: .sisyphus/evidence/task-8-no-regression.png
  ```

  **Commit**: YES
  - Message: `feat(activity): wire burst-grouped stream into main app`
  - Files: `src/client/src/App.tsx`
  - Pre-commit: `bun test && cd src/client && bun run test -- --run && bun run tsc -b`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(types): add StreamEntry types for burst-grouped activity stream` | types/index.ts | `bun run tsc -b` |
| 2 | `feat(activity): add burst grouping logic for activity stream redesign` | burstGrouping.ts, test | `bun test` |
| 3 | `feat(activity): typed tool expansion replacing raw JSON dump` | ActivityRow.tsx | `cd src/client && bun run test -- --run` |
| 4 | `feat(activity): burst rendering, visual hierarchy, and animation fix` | ActivityStream.tsx, BurstRow.tsx, MilestoneRow.tsx | `cd src/client && bun run test -- --run` |
| 5 | `feat(activity): per-agent swimlane view with tab toggle` | AgentSwimlane.tsx, ActivityStream.tsx | `cd src/client && bun run test -- --run` |
| 6 | `feat(activity): milestones-only mode toggle` | ActivityStream.tsx | `cd src/client && bun run test -- --run` |
| 7 | `test(activity): migrate and extend ActivityStream tests for burst model` | test files | `cd src/client && bun run test -- --run` |
| 8 | `feat(activity): wire burst-grouped stream into main app` | App.tsx | `bun test && cd src/client && bun run test -- --run` |

---

## Success Criteria

### Verification Commands
```bash
# All server tests
bun test                                    # Expected: 0 failures

# All client tests
cd src/client && bun run test -- --run      # Expected: 0 failures

# Type safety
bun run tsc -b                              # Expected: no errors

# Dev server
bun run dev                                 # Expected: starts on :5173
```

### Final Checklist
- [x] Activity stream shows burst-grouped entries (not individual tool calls)
- [x] Milestone events (spawn/complete/error) visually distinct from routine bursts
- [x] Expanding burst shows individual calls with typed fields (not raw JSON)
- [x] No reorder jank when new data arrives via polling
- [x] New items appear with smooth staggered animation
- [x] "Stream" / "Agents" tab toggle works
- [x] Swimlane view shows per-agent columns
- [x] Milestones-only toggle filters routine bursts
- [x] All existing tests preserved or migrated
- [x] Zero server-side changes
- [x] Zero new polling endpoints
