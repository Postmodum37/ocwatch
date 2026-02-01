# Agent Status Indicators & Live Monitoring

## TL;DR

> **Quick Summary**: Fix broken status indicators in OCWatch to accurately show agent working/idle/completed states, and display what each agent is currently doing (e.g., "Editing src/index.ts").
> 
> **Deliverables**:
> - Fixed status detection logic (working/idle/completed)
> - Current action display in LiveActivity panel
> - Extended part parser with tool parameters
> - Consolidated status utility function
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 4 → Task 5

---

## Context

### Original Request
"The loading state near each activity log doesn't make sense. It should show working when agents is working, show completed when agent is done and/or despawned. I also want to see what each agent is doing currently and have a live monitoring on what is he working now. Make sure it doesn't overcomplicate things. Use ultrawork."

### Interview Summary
**Key Discussions**:
- User confirmed "more detail on current action" - wants to see tool + target (e.g., "Editing src/index.ts")
- Keep it simple - don't overcomplicate
- Use ultrawork (ultrabrain category) for delegation

**Research Findings**:
- Current status detection uses wrong logic (`tokens === undefined` or 5-min timeout)
- Part files contain `state.input` with tool parameters (filePath, command, pattern)
- Status logic duplicated in 3 places in `src/server/index.ts`
- ToolCalls component exists but not wired
- Test infrastructure exists (bun test, vitest)

### Metis Review
**Identified Gaps** (addressed):
- Missing edge case handling for null `state.input` - will show tool name only
- No truncation strategy - will truncate to 40 chars
- Concurrent tool calls - will show most recent one
- Thresholds need confirmation - using 30s/5min as sensible defaults

---

## Work Objectives

### Core Objective
Fix agent status indicators to accurately reflect working/idle/completed states, and display current action with detail.

### Concrete Deliverables
- `src/server/utils/sessionStatus.ts` - New utility for status detection
- `src/server/storage/partParser.ts` - Extended to include `state.input`
- `src/shared/types/index.ts` - Updated types
- `src/client/src/components/SessionList.tsx` - Fixed status icons
- `src/client/src/components/LiveActivity.tsx` - Current action display
- `src/server/index.ts` - Use new status utility

### Definition of Done
- [x] Status indicators show: Working (spinner), Idle (pulse), Completed (check)
- [x] Current action displays tool + target (e.g., "Editing src/index.ts")
- [x] All tests pass: `bun test && cd src/client && bun run test`

### Must Have
- 3 distinct status states: working, idle, completed
- Current action from most recent tool call
- Graceful handling of missing data
- Dark theme consistent colors

### Must NOT Have (Guardrails)
- **NO** tool call history/timeline
- **NO** search/filter for tool calls
- **NO** tool results/output display
- **NO** progress bars or ETAs
- **NO** new API endpoints
- **NO** notifications/alerts
- **NO** duration/timing displays
- **NO** color-coding by tool type

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: YES (TDD-style where practical)
- **Framework**: bun test (server), vitest (client)

### Automated Verification Approach

Each TODO includes executable verification procedures that agents can run directly:

| Type | Verification Tool | Automated Procedure |
|------|------------------|---------------------|
| Backend logic | Bash + curl | Agent calls API, validates JSON response |
| Frontend UI | Playwright browser | Agent navigates, validates DOM state |
| Unit tests | Bash (bun test) | Agent runs tests, checks exit code |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Create status utility + types
└── Task 3: Extend part parser

Wave 2 (After Wave 1):
├── Task 2: Update server to use status utility
└── Task 4: Update SessionList UI

Wave 3 (After Wave 2):
└── Task 5: Update LiveActivity with current action
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 4, 5 | 3 |
| 2 | 1 | 4, 5 | None |
| 3 | None | 5 | 1 |
| 4 | 1, 2 | None | 5 (after 2) |
| 5 | 2, 3 | None | 4 |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 3 | `delegate_task(category="ultrabrain", load_skills=[], run_in_background=true)` x2 |
| 2 | 2, 4 | After Wave 1, dispatch both in parallel |
| 3 | 5 | Final integration task |

---

## TODOs

### Task 1: Create Session Status Utility + Types

**What to do**:
- Create `src/server/utils/sessionStatus.ts` with `getSessionStatus()` function
- Add `SessionStatus` type to `src/shared/types/index.ts`
- Status detection logic:
  ```typescript
  type SessionStatus = 'working' | 'idle' | 'completed';
  
  // working: has message < 30s old OR has pending tool call
  // idle: last message 30s-5min old
  // completed: last message > 5min old
  ```
- Export utility for use in server routes

**Must NOT do**:
- Add caching/memoization (compute on-the-fly)
- Add persistence (stateless)

**Recommended Agent Profile**:
- **Category**: `ultrabrain`
  - Reason: Logic-heavy task requiring careful threshold design
- **Skills**: `[]`
  - No specific skills needed - pure TypeScript logic

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Task 3)
- **Blocks**: Tasks 2, 4, 5
- **Blocked By**: None (can start immediately)

**References**:

**Pattern References**:
- `src/server/index.ts:75-82` - Current (broken) status logic to replace
- `src/server/index.ts:163-169` - Second instance of duplicated logic
- `src/server/index.ts:393-397` - Third instance of duplicated logic

**Type References**:
- `src/shared/types/index.ts:SessionMetadata` - Type to extend with status field
- `src/shared/types/index.ts:MessageMeta` - Message structure for timestamp checking

**Test References**:
- `src/server/__tests__/` - Server test patterns

**WHY Each Reference Matters**:
- Lines 75-82: Shows the current 5-minute threshold logic to understand and replace
- Types file: Where to add the new SessionStatus type export

**Acceptance Criteria**:

**Unit Tests** (TDD):
- [x] Test file created: `src/server/__tests__/sessionStatus.test.ts`
- [x] Test: session with message < 30s ago → `'working'`
- [x] Test: session with message 2 min ago → `'idle'`
- [x] Test: session with message 10 min ago → `'completed'`
- [x] Test: session with pending tool call → `'working'` (regardless of time)
- [x] `bun test src/server/__tests__/sessionStatus.test.ts` → PASS

**Automated Verification**:
```bash
# Agent runs:
bun test src/server/__tests__/sessionStatus.test.ts
# Assert: Exit code 0, all tests pass
```

**Commit**: YES
- Message: `feat(server): add session status utility with working/idle/completed detection`
- Files: `src/server/utils/sessionStatus.ts`, `src/shared/types/index.ts`, `src/server/__tests__/sessionStatus.test.ts`
- Pre-commit: `bun test src/server/__tests__/sessionStatus.test.ts`

---

### Task 2: Update Server to Use Status Utility

**What to do**:
- Import `getSessionStatus()` in `src/server/index.ts`
- Replace all 3 instances of inline status logic (lines 75-82, 163-169, 393-397)
- Add `status` field to session objects in API responses
- Add `currentAction` field to session objects (tool name + target)
- Update `/api/poll` response to include status and currentAction

**Must NOT do**:
- Add new API endpoints
- Change polling interval
- Add caching

**Recommended Agent Profile**:
- **Category**: `quick`
  - Reason: Straightforward replacement task - swap inline logic with utility calls
- **Skills**: `[]`
  - No specific skills needed

**Parallelization**:
- **Can Run In Parallel**: NO
- **Parallel Group**: Sequential (after Task 1)
- **Blocks**: Tasks 4, 5
- **Blocked By**: Task 1

**References**:

**Pattern References**:
- `src/server/index.ts:75-82` - First instance to replace
- `src/server/index.ts:163-169` - Second instance to replace
- `src/server/index.ts:393-397` - Third instance to replace
- `src/server/index.ts:346-453` - `/api/poll` endpoint to update

**API/Type References**:
- `src/shared/types/index.ts:PollResponse` - Response type to extend

**WHY Each Reference Matters**:
- Three inline logic locations: Must replace ALL to consolidate
- Poll endpoint: This is where status and currentAction get added to response

**Acceptance Criteria**:

**Automated Verification (API)**:
```bash
# Start server in background
bun run src/server/index.ts &
sleep 2

# Test status field exists
curl -s http://localhost:50234/api/poll | jq '.sessions[0].status'
# Assert: Output is one of "working", "idle", "completed" (not null)

# Test currentAction field exists
curl -s http://localhost:50234/api/poll | jq '.sessions[0].currentAction'
# Assert: Output is string or null (not undefined)

# Kill server
pkill -f "bun run src/server"
```

**Commit**: YES
- Message: `refactor(server): use sessionStatus utility, add currentAction to poll response`
- Files: `src/server/index.ts`
- Pre-commit: `bun test`

---

### Task 3: Extend Part Parser with Tool Parameters

**What to do**:
- Update `src/server/storage/partParser.ts` to extract `state.input`
- Add `ToolInput` type to `src/shared/types/index.ts`
- Create helper function `formatCurrentAction(part: PartMeta): string | null`
  - Priority order for display: `filePath > command > pattern > url > query > (tool name only)`
  - Truncate paths to 40 chars with ellipsis prefix: `...deeply/nested/file.ts`
  - Return `null` if no meaningful display possible

**Must NOT do**:
- Load all parts at once (maintain lazy loading)
- Add tool output/result data
- Add duration/timing

**Recommended Agent Profile**:
- **Category**: `ultrabrain`
  - Reason: Requires careful parameter extraction and formatting logic
- **Skills**: `[]`
  - No specific skills needed

**Parallelization**:
- **Can Run In Parallel**: YES
- **Parallel Group**: Wave 1 (with Task 1)
- **Blocks**: Task 5
- **Blocked By**: None (can start immediately)

**References**:

**Pattern References**:
- `src/server/storage/partParser.ts:17-26` - Current PartJSON interface to extend
- `src/server/storage/partParser.ts:33-50` - parsePart function to update

**Type References**:
- `src/shared/types/index.ts:PartMeta` - Type to extend with input field

**Documentation References**:
- Part file example from research:
  ```json
  {
    "state": {
      "status": "completed",
      "input": { "filePath": "/path/to/file.ts" },
      "title": "Editing file.ts"
    }
  }
  ```

**WHY Each Reference Matters**:
- PartJSON interface: Shows current structure, need to add `state.input`
- Example: Shows actual part file structure with input parameters

**Acceptance Criteria**:

**Unit Tests** (TDD):
- [x] Test file created: `src/server/__tests__/partParser.test.ts`
- [x] Test: `formatCurrentAction` with filePath → "Editing /short/path.ts"
- [x] Test: `formatCurrentAction` with long path → truncated to 40 chars
- [x] Test: `formatCurrentAction` with command → "Running bun test"
- [x] Test: `formatCurrentAction` with null input → tool name only
- [x] `bun test src/server/__tests__/partParser.test.ts` → PASS

**Automated Verification**:
```bash
# Agent runs:
bun test src/server/__tests__/partParser.test.ts
# Assert: Exit code 0, all tests pass
```

**Commit**: YES
- Message: `feat(server): extend part parser with tool parameters and formatCurrentAction`
- Files: `src/server/storage/partParser.ts`, `src/shared/types/index.ts`, `src/server/__tests__/partParser.test.ts`
- Pre-commit: `bun test src/server/__tests__/partParser.test.ts`

---

### Task 4: Update SessionList UI with Status Icons

**What to do**:
- Update `src/client/src/components/SessionList.tsx`
- Replace lines 127-131 (Activity/Clock icons) with status-based icons:
  - `working`: Spinner icon (Loader2 with spin animation), blue accent color `#58a6ff`
  - `idle`: Pulse animation (green dot), success color
  - `completed`: Check icon, gray/secondary color
- Replace line 138 (dot indicator) to match status
- Add `data-testid` attributes for testing

**Must NOT do**:
- Add tooltips or hover states
- Add click handlers
- Change layout structure

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
  - Reason: UI component update with visual state changes
- **Skills**: `["frontend-ui-ux"]`
  - frontend-ui-ux: Ensures consistent dark theme styling

**Parallelization**:
- **Can Run In Parallel**: YES (after Wave 2 start)
- **Parallel Group**: Wave 2 (with Task 5 start, after Task 2)
- **Blocks**: None
- **Blocked By**: Tasks 1, 2

**References**:

**Pattern References**:
- `src/client/src/components/SessionList.tsx:127-131` - Current icon logic to replace
- `src/client/src/components/SessionList.tsx:138` - Dot indicator to update
- `src/client/src/components/LiveActivity.tsx:64-77` - StatusIndicator pattern to follow

**Test References**:
- `src/client/src/components/__tests__/SessionList.test.tsx` - Existing test patterns
- `src/client/src/components/__tests__/LiveActivity.test.tsx` - Status indicator test patterns

**Documentation References**:
- AGENTS.md: Dark theme colors (`#58a6ff` accent, `#c9d1d9` text, `bg-success` green)

**WHY Each Reference Matters**:
- Lines 127-131: Exact location of icon logic to replace
- LiveActivity StatusIndicator: Pattern to follow for consistency
- Theme colors: Must use project's established color palette

**Acceptance Criteria**:

**Component Tests**:
- [x] Test: session with status='working' → spinner icon visible
- [x] Test: session with status='idle' → pulse dot visible
- [x] Test: session with status='completed' → check icon visible
- [x] `cd src/client && bun run test SessionList.test.tsx` → PASS

**Visual Verification (Playwright)**:
```typescript
// Agent executes via playwright browser automation:
// 1. Navigate to http://localhost:5173
// 2. Wait for sessions to load
// 3. Verify: At least one session has data-testid="session-status-*"
// 4. Screenshot: .sisyphus/evidence/task-4-session-status.png
```

**Commit**: YES
- Message: `feat(client): update SessionList with working/idle/completed status icons`
- Files: `src/client/src/components/SessionList.tsx`, `src/client/src/components/__tests__/SessionList.test.tsx`
- Pre-commit: `cd src/client && bun run test`

---

### Task 5: Add Current Action Display to LiveActivity

**What to do**:
- Update `src/client/src/components/LiveActivity.tsx`
- Add current action display below agent name:
  ```
  sisyphus · Editing src/index.ts
  ```
- Use `currentAction` field from poll response
- If no current action and status='working': show "Thinking..."
- If no current action and status!='working': show nothing
- Style: smaller font, muted color, truncate with ellipsis if needed
- Add `data-testid="current-action"` for testing

**Must NOT do**:
- Add tooltips with full path
- Add click-to-expand
- Show multiple actions

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
  - Reason: UI component with visual styling
- **Skills**: `["frontend-ui-ux"]`
  - frontend-ui-ux: Ensures proper text styling and truncation

**Parallelization**:
- **Can Run In Parallel**: NO (final integration)
- **Parallel Group**: Wave 3 (final)
- **Blocks**: None
- **Blocked By**: Tasks 2, 3

**References**:

**Pattern References**:
- `src/client/src/components/LiveActivity.tsx:139-203` - Main render logic
- `src/client/src/components/LiveActivity.tsx:170-180` - Where agent name is displayed

**Type References**:
- `src/shared/types/index.ts:ActivitySession` - Type to check for currentAction field

**Test References**:
- `src/client/src/components/__tests__/LiveActivity.test.tsx` - Existing test patterns

**WHY Each Reference Matters**:
- Lines 170-180: Exact location where agent name is rendered, add current action nearby
- ActivitySession type: Verify currentAction field is available

**Acceptance Criteria**:

**Component Tests**:
- [x] Test: session with currentAction → displays action text
- [x] Test: session with status='working' and no currentAction → displays "Thinking..."
- [x] Test: session with status='completed' and no currentAction → displays nothing
- [x] `cd src/client && bun run test LiveActivity.test.tsx` → PASS

**Visual Verification (Playwright)**:
```typescript
// Agent executes via playwright browser automation:
// 1. Navigate to http://localhost:5173
// 2. Wait for Live Activity panel to load
// 3. Verify: data-testid="current-action" contains text (or "Thinking...")
// 4. Screenshot: .sisyphus/evidence/task-5-current-action.png
```

**Commit**: YES
- Message: `feat(client): add current action display to LiveActivity panel`
- Files: `src/client/src/components/LiveActivity.tsx`, `src/client/src/components/__tests__/LiveActivity.test.tsx`
- Pre-commit: `cd src/client && bun run test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(server): add session status utility` | sessionStatus.ts, types | `bun test` |
| 2 | `refactor(server): use sessionStatus utility` | index.ts | `bun test` |
| 3 | `feat(server): extend part parser` | partParser.ts, types | `bun test` |
| 4 | `feat(client): update SessionList status icons` | SessionList.tsx | `cd src/client && bun run test` |
| 5 | `feat(client): add current action display` | LiveActivity.tsx | `cd src/client && bun run test` |

---

## Success Criteria

### Verification Commands
```bash
# All server tests pass
bun test
# Expected: All tests pass

# All client tests pass
cd src/client && bun run test
# Expected: All tests pass

# API returns status field
curl -s http://localhost:50234/api/poll | jq '.sessions[0].status'
# Expected: "working" | "idle" | "completed"

# API returns currentAction field
curl -s http://localhost:50234/api/poll | jq '.sessions[0].currentAction'
# Expected: "Editing src/file.ts" | "Thinking..." | null
```

### Final Checklist
- [x] All "Must Have" present (3 status states, current action display)
- [x] All "Must NOT Have" absent (no history, no progress bars, no new endpoints)
- [x] All tests pass
- [x] Visual states match spec (spinner/pulse/check with correct colors)
- [x] Current action truncates long paths correctly
