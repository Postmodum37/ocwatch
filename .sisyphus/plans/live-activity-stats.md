# Live Activity Session Statistics

## TL;DR

> **Quick Summary**: Add session statistics (token counts, model usage, cost) to the Live Activity header with a redesigned compact layout. Aggregate stats across the entire session tree (root + subagents).
> 
> **Deliverables**:
> - Extended `MessageMeta` type with `cost` field
> - Extended `/api/poll` response with `sessionStats` object
> - New `SessionStats.tsx` component displaying aggregated stats
> - Redesigned `App.tsx` header (compact branding left, stats right)
> - Component tests (TDD approach)
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (types) -> Task 2 (server) -> Task 4 (component) -> Task 5 (header)

---

## Context

### Original Request
User wants to enhance the Live Activity window with context/token statistics similar to OpenCode's sidebar. Key elements requested:
- Current context tokens displayed
- Statistics showing which provider/models were used
- Token totals per model

### Interview Summary
**Key Discussions**:
- **Placement**: Redesign header - compact OCWatch branding on left, stats on right (NOT a sidebar)
- **Token display**: Raw tokens only, no percentage calculation (skip context limits)
- **Model stats format**: Simple list showing each model with token count
- **Scope**: Full session tree (root + all subagent sessions aggregated)
- **Cost**: Extract from storage if available (field exists but not parsed)
- **Testing**: TDD approach - write tests first

**Research Findings**:
- Token data structure: `{input, output, reasoning?, cache?: {read, write}}`
- Model/Provider per message: `modelID`, `providerID` 
- Cost field exists in `MessageJSON` but not extracted to `MessageMeta`
- Server already has `detectAgentPhases()` and token aggregation logic
- Existing Vitest + React Testing Library setup for components

### Metis Review
**Identified Gaps** (addressed):
- Empty state handling: Show "—" placeholder when no data
- Cost data may be undefined: Conditionally render, show "—" if missing
- Number formatting: Use commas (18,518) for tokens, 2 decimal places for cost
- Long model names: Truncate with ellipsis
- Cache/reasoning tokens: Include in total (not shown separately)

---

## Work Objectives

### Core Objective
Add aggregated session statistics to a redesigned header, showing total tokens, per-model breakdown, and cost (when available) across the entire session hierarchy.

### Concrete Deliverables
- `src/shared/types/index.ts` - Extended `MessageMeta` with `cost` field, new `SessionStats` interface
- `src/server/storage/messageParser.ts` - Extract `cost` field
- `src/server/index.ts` - Add `sessionStats` to poll response
- `src/client/src/components/SessionStats.tsx` - New stats display component
- `src/client/src/components/__tests__/SessionStats.test.tsx` - Component tests
- `src/client/src/App.tsx` - Redesigned header layout

### Definition of Done
- [x] `bun test` passes (all server tests)
- [x] `cd src/client && bun run test` passes (all component tests)
- [x] `/api/poll` returns `sessionStats` with `totalTokens`, `totalCost`, `modelBreakdown`
- [x] Header displays stats when session selected, placeholder when not
- [x] Stats update on 2s polling cycle like other data

### Must Have
- Total tokens aggregated across session tree
- Model breakdown list (model name + tokens per model)
- Cost displayed when available
- Empty state when no session selected
- Compact header branding

### Must NOT Have (Guardrails)
- Context limit % calculation (explicitly excluded)
- Cost estimation from token pricing (only use stored values)
- Per-message cost breakdown (header is aggregate only)
- Token breakdown (input/output/cache shown separately)
- Charts or historical data
- Cost alerts/warnings or budget tracking
- Modify existing `detectAgentPhases()` behavior
- Collapsible/configurable stats section

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Bun test for server, Vitest for client)
- **User wants tests**: YES (TDD)
- **Framework**: `bun test` (server), `vitest` (client)

### TDD Workflow

Each TODO follows RED-GREEN-REFACTOR:

**Task Structure:**
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

**Test Commands:**
- Server: `bun test src/server/storage/__tests__/parsers.test.ts`
- Component: `cd src/client && bun run test src/components/__tests__/SessionStats.test.tsx`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add types (SessionStats, extend MessageMeta)
└── Task 3: Write SessionStats component tests (can scaffold before types complete)

Wave 2 (After Wave 1):
├── Task 2: Server changes (messageParser + poll endpoint)
└── Task 4: Implement SessionStats component

Wave 3 (After Wave 2):
└── Task 5: Redesign header layout
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 4 | 3 |
| 2 | 1 | 5 | 4 |
| 3 | None | 4 | 1 |
| 4 | 1, 3 | 5 | 2 |
| 5 | 2, 4 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended |
|------|-------|-------------|
| 1 | 1, 3 | Run in parallel |
| 2 | 2, 4 | Run in parallel after Wave 1 |
| 3 | 5 | Sequential (final integration) |

---

## TODOs

- [x] 1. Add TypeScript types for session statistics

  **What to do**:
  - Extend `MessageMeta` interface to include `cost?: number` field
  - Create new `SessionStats` interface with:
    - `totalTokens: number`
    - `totalCost?: number` (optional - may not be available)
    - `modelBreakdown: ModelTokens[]` where `ModelTokens = { modelID: string; providerID?: string; tokens: number }`
  - Add `sessionStats?: SessionStats` to `PollResponse` type (or create if inline)

  **Must NOT do**:
  - Add token breakdown fields (inputTokens, outputTokens, etc.) - keep simple
  - Add context limit fields - explicitly excluded

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple type additions to existing files
  - **Skills**: `[]`
    - No special skills needed for type definitions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Tasks 2, 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/shared/types/index.ts:26-38` - Existing `MessageMeta` interface structure
  - `src/shared/types/index.ts:44-59` - `ActivitySession` interface pattern (has optional fields)
  - `src/shared/types/index.ts:248-253` - `PlanProgress` interface pattern

  **API/Type References**:
  - `src/server/index.ts:580-587` - Current `PollResponse` interface definition
  - `src/server/storage/messageParser.ts:14-46` - `MessageJSON` showing `cost?: number` exists

  **Acceptance Criteria**:

  ```bash
  # Verify types compile without errors
  cd /Users/tomas/Workspace/ocwatch && bun run tsc --noEmit
  # Assert: Exit code 0, no type errors
  ```

  ```bash
  # Verify MessageMeta has cost field
  grep -A20 "export interface MessageMeta" src/shared/types/index.ts | grep "cost"
  # Assert: Output contains "cost?: number"
  ```

  ```bash
  # Verify SessionStats interface exists
  grep "export interface SessionStats" src/shared/types/index.ts
  # Assert: Output is non-empty
  ```

  **Commit**: YES
  - Message: `feat(types): add SessionStats interface and cost field to MessageMeta`
  - Files: `src/shared/types/index.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [x] 2. Extract cost field and add sessionStats to poll endpoint

  **What to do**:
  - Update `parseMessage()` in messageParser.ts to extract `cost` field from JSON
  - Add `cost` to the returned `MessageMeta` object
  - Create `aggregateSessionStats()` function that:
    - Takes `ActivitySession[]` and their messages
    - Sums total tokens across all sessions
    - Sums cost across all messages (where available)
    - Groups tokens by `modelID` to create breakdown
  - Call `aggregateSessionStats()` in `/api/poll` handler
  - Add `sessionStats` to `PollResponse`

  **Must NOT do**:
  - Modify `detectAgentPhases()` - create new aggregation function
  - Calculate/estimate costs - only use stored values
  - Add new API endpoints - extend existing `/api/poll`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Backend changes following established patterns
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/server/storage/messageParser.ts:53-83` - `parseMessage()` extraction pattern
  - `src/server/index.ts:54-83` - `detectAgentPhases()` aggregation pattern (for reference, don't modify)
  - `src/server/index.ts:353-355` - Token summing pattern

  **API/Type References**:
  - `src/server/storage/messageParser.ts:14-46` - `MessageJSON` with `cost` field (line 35)
  - `src/server/index.ts:607-743` - `/api/poll` handler to extend

  **Test References**:
  - `src/server/storage/__tests__/parsers.test.ts` - Parser test patterns

  **Acceptance Criteria**:

  **TDD - Write tests first:**
  ```typescript
  // In parsers.test.ts - add test for cost extraction
  test("parseMessage extracts cost field", async () => {
    // Mock message with cost
    const result = await parseMessage(mockMessageWithCost);
    expect(result?.cost).toBe(0.0234);
  });
  ```

  **Verify via curl:**
  ```bash
  # Start server if not running
  bun run dev:server &
  sleep 2

  # Verify sessionStats in poll response
  curl -s http://localhost:50234/api/poll | jq '.sessionStats'
  # Assert: Returns object (may be null if no active session)

  # When session active, verify structure
  curl -s http://localhost:50234/api/poll | jq '.sessionStats | keys'
  # Assert: Contains ["totalTokens", "modelBreakdown"] at minimum
  ```

  ```bash
  # Run server tests
  bun test src/server/storage/__tests__/parsers.test.ts
  # Assert: All tests pass
  ```

  **Evidence to Capture:**
  - [x] Test output showing parseMessage cost extraction test passes
  - [x] curl output showing sessionStats structure

  **Commit**: YES
  - Message: `feat(server): extract cost field and add sessionStats to poll endpoint`
  - Files: `src/server/storage/messageParser.ts`, `src/server/index.ts`
  - Pre-commit: `bun test`

---

- [x] 3. Write SessionStats component tests (TDD - RED phase)

  **What to do**:
  - Create `src/client/src/components/__tests__/SessionStats.test.tsx`
  - Write tests for:
    - Renders total tokens formatted with commas (e.g., "18,518 tokens")
    - Renders cost formatted with $ and 2 decimals (e.g., "$0.23")
    - Renders "—" when cost is undefined
    - Renders model breakdown list with model names and token counts
    - Renders empty/placeholder state when `stats` prop is null/undefined
    - Handles empty modelBreakdown array gracefully
  - Tests should FAIL initially (component doesn't exist yet)

  **Must NOT do**:
  - Implement the component yet - this is RED phase only
  - Add tests for features not in scope (charts, cost alerts, etc.)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Writing tests following established patterns
  - **Skills**: `[]`
    - Standard Vitest/RTL patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/client/src/components/__tests__/PlanProgress.test.tsx` - Component test structure
  - `src/client/src/components/__tests__/LiveActivity.test.tsx` - Mock data patterns

  **Test References**:
  - `src/client/vite.config.ts` - Vite/Vitest configuration
  - `src/client/src/setupTests.ts` - Test setup file

  **Acceptance Criteria**:

  ```bash
  # Verify test file exists
  ls src/client/src/components/__tests__/SessionStats.test.tsx
  # Assert: File exists

  # Run tests - should FAIL (component not implemented)
  cd src/client && bun run test src/components/__tests__/SessionStats.test.tsx 2>&1 | head -20
  # Assert: Tests fail with "Cannot find module" or similar (expected in RED phase)
  ```

  **Evidence to Capture:**
  - [x] Test file content showing test cases
  - [x] Test failure output (RED phase confirmation)

  **Commit**: YES
  - Message: `test(client): add SessionStats component tests (RED phase)`
  - Files: `src/client/src/components/__tests__/SessionStats.test.tsx`
  - Pre-commit: None (tests expected to fail)

---

- [x] 4. Implement SessionStats component (TDD - GREEN phase)

  **What to do**:
  - Create `src/client/src/components/SessionStats.tsx`
  - Implement component that:
    - Accepts `stats?: SessionStats` prop
    - Shows "—" placeholder when stats is null/undefined
    - Displays total tokens with comma formatting (use `toLocaleString()`)
    - Displays cost as "$X.XX" when available, "—" when undefined
    - Renders model breakdown as simple list: "model-name: X,XXX tokens"
    - Truncates long model names with ellipsis (max ~20 chars)
  - Follow existing component patterns (Tailwind classes, Lucide icons)
  - Run tests - should PASS

  **Must NOT do**:
  - Add interactivity (click handlers, expand/collapse)
  - Add charts or visualizations
  - Add cost estimation logic

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Frontend component with styling
  - **Skills**: `["frontend-ui-ux"]`
    - For clean, minimal component design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 3

  **References**:

  **Pattern References**:
  - `src/client/src/components/PlanProgress.tsx` - Small stats component pattern
  - `src/client/src/components/LiveActivity.tsx:170-185` - Token/model display pattern
  - `src/client/src/components/AgentBadge.tsx` - Simple styled component pattern

  **Styling References**:
  - `src/client/src/styles/index.css` - Tailwind theme colors
  - Colors: `text-text-primary`, `text-text-secondary`, `bg-surface`, `border-border`

  **Type References**:
  - `src/shared/types/index.ts` - SessionStats interface (from Task 1)

  **Acceptance Criteria**:

  **TDD - Make tests pass:**
  ```bash
  # Run SessionStats tests
  cd src/client && bun run test src/components/__tests__/SessionStats.test.tsx
  # Assert: All tests pass (GREEN phase)
  ```

  **Visual verification via Playwright (if available) or manual:**
  ```
  # Agent runs dev server and captures screenshot:
  1. Navigate to: http://localhost:5173
  2. Wait for app to load
  3. Inspect SessionStats component rendering in React DevTools
  4. Screenshot: .sisyphus/evidence/task-4-sessionstats.png
  ```

  **Evidence to Capture:**
  - [x] Test output showing all SessionStats tests pass
  - [x] Component file created with correct structure

  **Commit**: YES
  - Message: `feat(client): implement SessionStats component (GREEN phase)`
  - Files: `src/client/src/components/SessionStats.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [x] 5. Redesign header layout with SessionStats integration

  **What to do**:
  - Modify `src/client/src/App.tsx` header section:
    - Make OCWatch branding more compact (smaller icon, single line text)
    - Add SessionStats component on the right side
    - Keep PlanProgress in header (adjust positioning as needed)
    - Keep reconnecting badge functional
  - Pass `sessionStats` from poll data to SessionStats component
  - Handle case where sessionStats is undefined (initial load, no session)
  - Ensure responsive behavior (stats don't overflow on narrow screens)

  **Must NOT do**:
  - Change any other parts of App.tsx layout
  - Modify LiveActivity or ActivityStream components
  - Add new polling mechanisms

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI layout redesign
  - **Skills**: `["frontend-ui-ux"]`
    - For clean header layout

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential, final)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 2, 4

  **References**:

  **Pattern References**:
  - `src/client/src/App.tsx:69-90` - Current header implementation
  - `src/client/src/App.tsx:85-89` - PlanProgress integration pattern

  **Styling References**:
  - Compact header pattern: `gap-2` instead of `gap-3`, smaller icon (`w-5 h-5`), condensed text

  **Type References**:
  - `src/client/src/store/AppContext.tsx` - May need to add sessionStats to context

  **Acceptance Criteria**:

  **Visual verification via dev server:**
  ```bash
  # Ensure dev server is running
  bun run dev &
  sleep 3

  # Verify app loads without errors
  curl -s http://localhost:5173 | head -5
  # Assert: Returns HTML (Vite dev server responding)
  ```

  **Via Playwright browser automation:**
  ```
  # Agent executes:
  1. Navigate to: http://localhost:5173
  2. Wait for: selector "h1" containing "OCWatch" to be visible
  3. Assert: SessionStats component visible (look for "tokens" text)
  4. Assert: Branding is compact (h1 smaller than before)
  5. Assert: No layout overflow issues
  6. Screenshot: .sisyphus/evidence/task-5-header-redesign.png
  ```

  **Run all client tests:**
  ```bash
  cd src/client && bun run test
  # Assert: All tests pass
  ```

  **Evidence to Capture:**
  - [x] Screenshot showing redesigned header with stats
  - [x] Test output showing all client tests pass

  **Commit**: YES
  - Message: `feat(client): redesign header with compact branding and SessionStats`
  - Files: `src/client/src/App.tsx`, possibly `src/client/src/store/AppContext.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(types): add SessionStats interface and cost field to MessageMeta` | types/index.ts | `bun run tsc --noEmit` |
| 2 | `feat(server): extract cost field and add sessionStats to poll endpoint` | messageParser.ts, index.ts | `bun test` |
| 3 | `test(client): add SessionStats component tests (RED phase)` | SessionStats.test.tsx | N/A (tests fail) |
| 4 | `feat(client): implement SessionStats component (GREEN phase)` | SessionStats.tsx | Client tests pass |
| 5 | `feat(client): redesign header with compact branding and SessionStats` | App.tsx | All tests pass |

---

## Success Criteria

### Verification Commands
```bash
# All server tests pass
bun test
# Expected: All tests pass

# All client tests pass
cd src/client && bun run test
# Expected: All tests pass including new SessionStats tests

# TypeScript compiles without errors
bun run tsc --noEmit
# Expected: Exit code 0

# Poll endpoint returns sessionStats
curl -s http://localhost:50234/api/poll | jq '.sessionStats'
# Expected: Object with totalTokens, modelBreakdown (when session active)
```

### Final Checklist
- [x] Total tokens displayed in header with comma formatting
- [x] Model breakdown shows each model used with token count
- [x] Cost displayed when available (from storage)
- [x] "—" placeholder shown when data unavailable
- [x] Header branding is compact (smaller than before)
- [x] Stats update on 2s polling cycle
- [x] All tests pass
- [x] No TypeScript errors
