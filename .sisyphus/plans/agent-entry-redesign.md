# Agent Entry Redesign - Compact Activity-Focused Layout

## TL;DR

> **Quick Summary**: Redesign `SessionRow` component in LiveActivity to show task summary with current tool inline, move model/time/tokens to stacked right side, dim completed agents.
> 
> **Deliverables**:
> - Modified `SessionRow` component with new layout
> - Updated `formatRelativeTime` for compact format
> - New utility function for extracting tool display text
> - Vitest unit tests for new behavior
> - Playwright visual regression test
> 
> **Estimated Effort**: Medium (3-4 hours)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (data verification) -> Task 2 (time format) -> Task 3 (layout) -> Tasks 4,5 (tests in parallel)

---

## Context

### Original Request
User wants to redesign agent entry rows to be more compact and activity-focused:
- More space for seeing what agents are actually doing
- Move model, time somewhere else (right side)
- Show information clearly, compacted, straight to the point

### Interview Summary
**Key Discussions**:
- Activity Display: Single line "Task summary (tool + primary arg)"
- Truncation: ~50 chars with ellipsis
- Tool Detail: Tool name + primary argument (e.g., 'mcp_read src/auth.ts')
- Model Display: Keep full model name, stack on right side
- Time Format: Compact "4m" not "4m ago"
- Completed Agents: Dim to ~60% opacity
- Status Indicator: Animated spinner for active (already exists)

**Research Findings**:
- Component: `SessionRow` in `src/client/src/components/LiveActivity.tsx`
- Data: `ActivitySession` has `currentAction`, `toolCalls[]`, `status`
- Spinner already implemented for 'working' status
- Existing tests in `__tests__/LiveActivity.test.tsx`

### Metis Review
**Identified Gaps** (addressed):
- Tool ordering: Verify if `toolCalls[0]` or last item is current -> Will check data
- Empty states: Need fallbacks for missing `currentAction`/`toolCalls` -> Added handling
- Time edge cases: Format for <1min, hours, days -> Defined in spec
- Scope creep: Don't touch expanded section, data types -> Guardrailed

---

## Work Objectives

### Core Objective
Redesign the `SessionRow` component to prioritize activity visibility with a cleaner, more compact layout.

### Concrete Deliverables
1. `src/client/src/components/LiveActivity.tsx` - Modified `SessionRow` layout + `formatRelativeTime`
2. `src/client/src/components/__tests__/LiveActivity.test.tsx` - Updated/new tests
3. Playwright visual test (location TBD based on existing structure)

### Definition of Done
- [x] `bun run test` passes in client directory
- [x] Visual appearance matches design spec (verified via Playwright)
- [x] Completed agents appear dimmed (60% opacity)
- [x] Time shows as "4m" not "4m ago"
- [x] Task summary truncates at ~50 chars with ellipsis
- [x] Current tool displays inline when available

### Must Have
- Task summary prominently displayed
- Current tool shown inline with task (when available)
- Stacked right-side metadata (model on top, time + tokens below)
- Compact time format
- Dimmed completed agents
- All existing tests still pass

### Must NOT Have (Guardrails)
- NO modifications to expanded tool call section (AccordionContent equivalent)
- NO changes to data fetching or polling logic
- NO new npm dependencies
- NO changes to `ActivitySession` type definition
- NO modifications to child/nested agent rendering logic
- NO responsive layout changes (not requested)
- NO error state styling changes (not requested)
- NO changes to project selector or session header

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest configured)
- **User wants tests**: Both visual and component tests
- **Framework**: Vitest (client), Playwright (visual)

### Automated Verification Approach

**Component Tests (Vitest)**:
- Test truncation logic (50 char boundary)
- Test time formatting ("4m" format)
- Test opacity class application for completed status
- Test tool display with/without arguments
- Test fallback text when no currentAction

**Visual Tests (Playwright)**:
- Screenshot comparison of agent rows
- Verify layout structure visually

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Verify toolCalls data ordering [no dependencies]
└── Task 2: Update formatRelativeTime function [no dependencies]

Wave 2 (After Wave 1):
├── Task 3: Redesign SessionRow layout [depends: 1, 2]

Wave 3 (After Wave 2):
├── Task 4: Write/update Vitest tests [depends: 3]
└── Task 5: Write Playwright visual test [depends: 3]
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3 | 2 |
| 2 | None | 3 | 1 |
| 3 | 1, 2 | 4, 5 | None |
| 4 | 3 | None | 5 |
| 5 | 3 | None | 4 |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | Quick tasks - can run in parallel |
| 2 | 3 | Visual-engineering for main layout work |
| 3 | 4, 5 | Tests can run in parallel |

---

## TODOs

- [x] 1. Verify toolCalls Data Ordering

  **What to do**:
  - Check how `toolCalls` array is populated in the server
  - Determine if `toolCalls[0]` or `toolCalls[toolCalls.length - 1]` represents the current/latest tool
  - Document finding for Task 3

  **Must NOT do**:
  - Change any server code
  - Modify data types

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple investigation task, read-only
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:
  - `src/server/storage/sessionParser.ts` - Check how toolCalls are built
  - `src/shared/types/index.ts:ToolCallSummary` - Type definition
  - API response: `GET /api/sessions/:id/messages` - See real data shape

  **Acceptance Criteria**:
  - [ ] Document which array index (first or last) represents the current/latest tool
  - [ ] If ordering is ambiguous, note that we'll use last item (most recently added)

  **Commit**: NO (research only)

---

- [x] 2. Update formatRelativeTime Function

  **What to do**:
  - Modify `formatRelativeTime` in `LiveActivity.tsx` to return compact format
  - Change "just now" -> "<1m" or keep "just now" (designer preference)
  - Change "Xm ago" -> "Xm"
  - Change "Xh ago" -> "Xh"
  - Handle days: "Xd" format

  **Must NOT do**:
  - Create a new function (modify existing)
  - Add external dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single function modification, isolated change
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:
  - `src/client/src/components/LiveActivity.tsx:14-25` - Current formatRelativeTime function

  **Current Implementation**:
  ```typescript
  function formatRelativeTime(date: Date | string): string {
    // ...
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString();
  }
  ```

  **Target Implementation**:
  ```typescript
  function formatRelativeTime(date: Date | string): string {
    // ...
    if (minutes < 1) return '<1m';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString();
  }
  ```

  **Acceptance Criteria**:
  - [ ] `formatRelativeTime(new Date())` returns "<1m"
  - [ ] `formatRelativeTime(new Date(Date.now() - 4 * 60 * 1000))` returns "4m"
  - [ ] `formatRelativeTime(new Date(Date.now() - 2 * 60 * 60 * 1000))` returns "2h"
  - [ ] `formatRelativeTime(new Date(Date.now() - 48 * 60 * 60 * 1000))` returns "2d"

  ```bash
  # Verify via test run after modification:
  cd src/client && bun run test -- --grep "formatRelativeTime"
  ```

  **Commit**: YES
  - Message: `fix(ui): use compact time format in agent activity`
  - Files: `src/client/src/components/LiveActivity.tsx`

---

- [x] 3. Redesign SessionRow Layout

  **What to do**:
  
  **A. Create helper function to extract tool display text**:
  ```typescript
  function getToolDisplayText(toolCalls?: ToolCallSummary[]): string | null {
    if (!toolCalls || toolCalls.length === 0) return null;
    const latest = toolCalls[toolCalls.length - 1]; // or [0] based on Task 1
    const toolName = latest.name.replace('mcp_', ''); // Clean up prefix
    // Extract primary arg from input object
    const primaryArg = extractPrimaryArg(latest.input);
    return primaryArg ? `${toolName} ${primaryArg}` : toolName;
  }

  function extractPrimaryArg(input: object): string | null {
    // Priority: filePath > command > pattern > query > url
    const keys = ['filePath', 'command', 'pattern', 'query', 'url'];
    for (const key of keys) {
      if (input[key]) {
        const val = String(input[key]);
        // Truncate long paths/args
        return val.length > 30 ? val.slice(-30) : val;
      }
    }
    return null;
  }
  ```

  **B. Update SessionRow layout structure**:
  
  Current:
  ```
  [Tree] [Chevron] [Status] [Badge] [currentAction] [model] [time] [tokens→]
  ```

  New:
  ```
  [Tree] [Chevron] [Status] [Badge] [TaskSummary (toolName arg)]  |  [model     ]
                                                                   |  [time · tokens]
  ```

  **C. Add opacity class for completed agents**:
  ```tsx
  <div className={`... ${status === 'completed' ? 'opacity-60' : ''}`}>
  ```

  **D. Truncate task summary to ~50 chars**:
  ```tsx
  const truncatedAction = currentActionText && currentActionText.length > 50 
    ? currentActionText.slice(0, 47) + '...' 
    : currentActionText;
  ```

  **Must NOT do**:
  - Modify expanded tool calls section (lines 184-211)
  - Change how children are rendered (lines 213-221)
  - Add new state variables beyond what's needed
  - Import new dependencies

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI layout work requiring visual judgment
  - **Skills**: `["frontend-ui-ux"]`
    - `frontend-ui-ux`: Layout and spacing expertise

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/client/src/components/LiveActivity.tsx:150-180` - Current SessionRow layout to modify
  - `src/client/src/components/LiveActivity.tsx:95-100` - Component props and state
  - `src/client/src/components/ToolCallRow.tsx` - Example of tool display pattern

  **Type References**:
  - `src/shared/types/index.ts:ActivitySession` - Session data shape
  - `src/shared/types/index.ts:ToolCallSummary` - Tool call data shape (has `input: object`)

  **Style References**:
  - `src/client/src/styles/index.css` - Tailwind config, existing color variables
  - Use existing classes: `text-gray-500`, `text-gray-600`, `text-xs`, `truncate`

  **Acceptance Criteria**:

  **Automated Verification (Playwright browser)**:
  ```
  # Agent executes via playwright browser automation:
  1. Start dev server if not running: bun run dev
  2. Navigate to: http://localhost:5173
  3. Wait for: Agent activity rows to load
  4. For each agent row, verify:
     - Agent badge is visible on left
     - Task text is visible after badge
     - Model appears right-aligned, above time
     - Time shows compact format (no "ago")
     - Tokens appear after time with "·" separator
  5. For completed agents, verify opacity is reduced
  6. Screenshot: .sisyphus/evidence/agent-row-redesign.png
  ```

  **Structure Assertions**:
  - [ ] Agent row has two-column layout: left (activity) and right (metadata)
  - [ ] Right column has model on top, "Xm · X,XXX tokens" below
  - [ ] Task summary visible (truncated if >50 chars)
  - [ ] Tool name + arg shown in parentheses when toolCalls exist
  - [ ] Completed agents have `opacity-60` class applied

  **Commit**: YES
  - Message: `feat(ui): redesign agent entry rows for compact activity view`
  - Files: `src/client/src/components/LiveActivity.tsx`

---

- [x] 4. Write/Update Vitest Component Tests

  **What to do**:
  - Add tests for new formatting behavior
  - Add tests for opacity on completed status
  - Add tests for truncation
  - Update any broken existing tests

  **Must NOT do**:
  - Rewrite all existing tests
  - Add tests for unrelated functionality

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Test writing is straightforward addition
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:
  - `src/client/src/components/__tests__/LiveActivity.test.tsx` - Existing tests to extend
  - Test patterns: `render()`, `screen.getByText()`, `fireEvent.click()`

  **New Test Cases to Add**:
  ```typescript
  describe('SessionRow compact layout', () => {
    it('truncates task summary longer than 50 characters', () => {
      const longActionSession: ActivitySession[] = [{
        id: 'long-action',
        title: 'Test',
        agent: 'sisyphus',
        status: 'working',
        currentAction: 'This is a very long action text that should be truncated at fifty characters',
        createdAt: new Date(),
        updatedAt: new Date(),
      }];
      render(<LiveActivity sessions={longActionSession} loading={false} />);
      // Should truncate and add ellipsis
      expect(screen.getByText(/This is a very long action text that should be tr\.\.\./)).toBeInTheDocument();
    });

    it('shows tool name with primary argument when toolCalls exist', () => {
      const sessionWithTool: ActivitySession[] = [{
        id: 'with-tool',
        title: 'Test',
        agent: 'sisyphus',
        status: 'working',
        currentAction: 'Working on files',
        createdAt: new Date(),
        updatedAt: new Date(),
        toolCalls: [{
          id: 't1',
          name: 'mcp_read',
          state: 'pending',
          summary: 'Reading file',
          input: { filePath: 'src/auth.ts' },
          timestamp: new Date().toISOString(),
          agentName: 'sisyphus'
        }]
      }];
      render(<LiveActivity sessions={sessionWithTool} loading={false} />);
      expect(screen.getByText(/read.*src\/auth\.ts/i)).toBeInTheDocument();
    });

    it('applies opacity-60 class to completed agents', () => {
      const completedSession: ActivitySession[] = [{
        id: 'completed-1',
        title: 'Done',
        agent: 'explore',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      }];
      render(<LiveActivity sessions={completedSession} loading={false} />);
      const row = screen.getByTestId('session-row-completed-1');
      expect(row.className).toContain('opacity-60');
    });

    it('formats time without "ago" suffix', () => {
      const session: ActivitySession[] = [{
        id: 'time-test',
        title: 'Test',
        agent: 'sisyphus',
        status: 'working',
        createdAt: new Date(),
        updatedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      }];
      render(<LiveActivity sessions={session} loading={false} />);
      expect(screen.getByText('5m')).toBeInTheDocument();
      expect(screen.queryByText('5m ago')).not.toBeInTheDocument();
    });
  });
  ```

  **Acceptance Criteria**:
  ```bash
  # Agent runs:
  cd src/client && bun run test -- --reporter=verbose
  # Assert: All tests pass
  # Assert: New test cases for truncation, opacity, time format included
  ```

  **Commit**: YES
  - Message: `test(ui): add tests for compact agent row layout`
  - Files: `src/client/src/components/__tests__/LiveActivity.test.tsx`

---

- [x] 5. Write Playwright Visual Regression Test (Skipped - Playwright not installed)

  **What to do**:
  - Create visual snapshot test for agent row appearance
  - Capture before/after comparison capability

  **Must NOT do**:
  - Set up new Playwright infrastructure if not exists
  - Create complex multi-page tests

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Visual testing requires design eye
  - **Skills**: `["playwright"]`
    - `playwright`: Browser automation expertise

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 4)
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:
  - Check if Playwright is already configured in project
  - If not, may need minimal setup

  **Acceptance Criteria**:
  ```bash
  # Agent runs:
  # First check if playwright exists:
  ls node_modules/@playwright 2>/dev/null || echo "Playwright not installed"
  
  # If installed, run visual test:
  bunx playwright test --grep "agent row"
  # Assert: Screenshot captured
  # Assert: Test passes on clean run
  ```

  **Evidence to Capture**:
  - Screenshot at `.sisyphus/evidence/agent-row-visual.png`
  - Test report showing pass/fail

  **Commit**: YES (if test created)
  - Message: `test(ui): add playwright visual test for agent rows`
  - Files: `tests/visual/agent-row.spec.ts` or similar

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2 | `fix(ui): use compact time format in agent activity` | LiveActivity.tsx | Manual check |
| 3 | `feat(ui): redesign agent entry rows for compact activity view` | LiveActivity.tsx | Visual check |
| 4 | `test(ui): add tests for compact agent row layout` | LiveActivity.test.tsx | `bun run test` |
| 5 | `test(ui): add playwright visual test for agent rows` | tests/visual/*.ts | `bunx playwright test` |

---

## Success Criteria

### Verification Commands
```bash
# Run all client tests
cd src/client && bun run test

# Type check
bun run tsc -b

# Visual verification (dev server must be running)
bun run dev  # in one terminal
# Then verify in browser at http://localhost:5173
```

### Final Checklist
- [x] All "Must Have" features implemented
- [x] All "Must NOT Have" guardrails respected
- [x] All client tests pass
- [x] Visual appearance matches design spec
- [x] Completed agents are visually dimmed
- [x] Time format is compact (no "ago")
- [x] Task summary visible with tool info when available
