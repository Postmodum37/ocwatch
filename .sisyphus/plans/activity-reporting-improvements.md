# Activity Reporting Improvements

## TL;DR

> **Quick Summary**: Fix critical live view freeze bug, then improve tool/work reporting in OCWatch's Activity Stream - better descriptions for delegate_task and todo actions, fix "Completed task (waiting)" bug.
> 
> **Deliverables**:
> - **[CRITICAL]** Fix SSE liveness detection - live view freezing until page refresh
> - Fix completion event bug (only emit for status="completed")
> - Enhanced delegate_task display: "Description (agent-type)"
> - Enhanced todowrite/todoread display: "Updated N todos: X, Y..."
> - ~~Fix auto-scroll timing~~ (user reports it's working, verify only)
> 
> **Estimated Effort**: Short (4-5 tasks, ~2-3 hours)
> **Parallel Execution**: NO - sequential (TDD requires test→impl flow)
> **Critical Path**: Task 0 (SSE fix) → Task 1 (completion bug) → Task 2 (delegate_task) → Task 3 (todos) → Task 4 (verify scroll)

---

## Context

### Original Request
User wants to improve tool/work reporting for agents/subagents in Live Activity window. Specifically better descriptions, states, and names for the actions agents make.

### Interview Summary
**Key Discussions**:
- **[CRITICAL]** Live view freezes until page refresh - highest priority fix
- delegate_task display: User chose "Description + Agent Type" format
- todowrite/todoread: User chose "Summary with preview" showing first todo items
- "Completed task (waiting)": User confirmed this is a bug to fix
- Auto-scroll: User reports it "kind of seems working" - verify only
- Test strategy: User chose TDD approach

**Research Findings**:
- **[CRITICAL] SSE silent failure**: `useSSE` hook uses Server-Sent Events with `fs.watch()` on server. When `fs.watch()` silently stops emitting events (known Node.js issue), SSE connection stays open but no updates are sent. Since no `onerror` fires, fallback to polling never triggers.
- delegate_task input contains: `description`, `subagent_type`, `category`, `prompt`
- todowrite input contains: `todos[]` with `id`, `content`, `status`, `priority`
- ToolInput type has `[key: string]: unknown` (flexible, use type assertions)
- Bug location: `activityUtils.ts` line 44 emits completion for "waiting" status
- Scroll issue: May need requestAnimationFrame fix (verify first)

### Metis Review
**Identified Gaps** (addressed):
- Empty/missing fields need fallbacks (added to acceptance criteria)
- Character limits for previews (set to 30 chars)
- Edge cases: empty todos array, undefined content (added handling)
- Scroll edge case: first item to empty stream (verified handled)

---

## Work Objectives

### Core Objective
Improve Activity Stream readability by showing meaningful descriptions for delegate_task and todo operations, fixing the completion event bug, and ensuring auto-scroll works correctly.

### Concrete Deliverables
- `src/shared/utils/activityUtils.ts`: Fix line 44 condition
- `src/server/storage/partParser.ts`: Enhanced `formatCurrentAction()` for delegate_task, todowrite, todoread
- `src/client/src/components/ActivityStream.tsx`: Fix scroll timing with requestAnimationFrame
- Tests for all changes (TDD approach)

### Definition of Done
- [x] `bun test` passes all tests
- [x] `cd src/client && bun run test` passes all tests
- [x] No "Completed task (waiting)" in Activity Stream
- [x] delegate_task shows "Description (agent-type)" format
- [x] todowrite shows "Updated N todos: X, Y..."
- [x] Auto-scroll works when at bottom and new items arrive

### Must Have
- Fix completion event bug (only status="completed" creates event)
- delegate_task format: "Description (agent-type)" with fallbacks
- todowrite format: "Updated N todos: X, Y..."
- todoread format: "Reading todos"
- Auto-scroll fix using requestAnimationFrame

### Must NOT Have (Guardrails)
- DO NOT change ToolInput interface (use type assertions)
- DO NOT add new ActivityItem types (fix within existing types)
- DO NOT add formatting for other tools (only delegate_task, todowrite, todoread)
- DO NOT add new dependencies
- DO NOT refactor ActivityStream beyond the scroll fix
- DO NOT add interactive/collapsible elements
- DO NOT add configuration options (hardcode reasonable defaults)

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision
- **Infrastructure exists**: YES (Vitest for client, Bun test for shared/server)
- **Automated tests**: TDD (tests first)
- **Framework**: Vitest (client), Bun test (shared utils)

### If TDD Enabled

Each TODO follows RED-GREEN-REFACTOR:

**Task Structure:**
1. **RED**: Write failing test first
   - Test command: `bun test [file]` or `cd src/client && bun run test [file]`
   - Expected: FAIL (test exists, implementation doesn't)
2. **GREEN**: Implement minimum code to pass
   - Expected: PASS
3. **REFACTOR**: Clean up while keeping green
   - Expected: PASS (still)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

All verification via automated tests. No manual QA required - the tests ARE the QA.

---

## Execution Strategy

### Sequential Execution (TDD)

```
Task 0: [CRITICAL] Fix SSE liveness detection
  └── Task 1: Fix completion event bug
      └── Task 2: Enhanced delegate_task display
          └── Task 3: Enhanced todo display
              └── Task 4: Verify auto-scroll (user reports working)
```

**Why Sequential**: TDD requires test→impl flow. Each task builds on stable foundation.

### Dependency Matrix

| Task | Depends On | Blocks |
|------|------------|--------|
| 0 | None | 1, 2, 3, 4 |
| 1 | 0 | 2, 3, 4 |
| 2 | 1 | 3 |
| 3 | 2 | 4 |
| 4 | 3 | None |

---

## TODOs

- [x] 0. **[CRITICAL]** Fix SSE liveness detection - live view freezing

  **Root Cause Analysis**:
  The live view freezes because SSE connection can appear active while `fs.watch()` silently stops emitting events. Since no `onerror` is triggered, the fallback to polling never kicks in.

  **What to do**:
  - Add liveness timeout to `useSSE` hook
  - Track when last meaningful event (session-update, message-update, plan-update) was received
  - If no events for 45 seconds (30s heartbeat + 15s buffer), force reconnection or fallback to polling
  - Write tests for liveness timeout behavior

  **Implementation**:
  ```typescript
  // In useSSE.ts, add:
  const lastEventTimeRef = useRef<number>(Date.now());
  const livenessCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // In SSE event handlers, update:
  lastEventTimeRef.current = Date.now();
  
  // Add liveness check interval:
  livenessCheckRef.current = setInterval(() => {
    const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
    if (timeSinceLastEvent > 45000) { // 45 seconds
      console.warn('SSE liveness timeout - switching to polling');
      eventSourceRef.current?.close();
      setIsUsingFallback(true);
    }
  }, 10000); // Check every 10 seconds
  ```

  **Must NOT do**:
  - Do NOT remove SSE entirely (it works most of the time)
  - Do NOT change heartbeat interval
  - Do NOT break existing polling fallback

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused change to one hook with clear behavior
  - **Skills**: `[]`
    - No specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (FIRST - highest priority)
  - **Blocks**: Tasks 1, 2, 3, 4
  - **Blocked By**: None

  **References**:
  - `src/client/src/hooks/useSSE.ts` - Hook that needs liveness detection
  - `src/client/src/hooks/useSSE.ts:129-132` - Event handlers where to update lastEventTime
  - `src/client/src/hooks/useSSE.ts:134-142` - onerror handler pattern to follow
  - `src/server/routes/sse.ts:25-34` - Server heartbeat (30s interval)

  **Acceptance Criteria**:

  - [ ] `lastEventTimeRef` tracks time of last meaningful event
  - [ ] Liveness check runs every 10 seconds
  - [ ] If no events for 45s, SSE is closed and `isUsingFallback` set to true
  - [ ] Polling takes over when SSE goes stale
  - [ ] Tests verify liveness timeout behavior
  - [ ] `cd src/client && bun run test useSSE` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: SSE liveness timeout triggers fallback
    Tool: Bash
    Steps:
      1. Run: cd src/client && bun run test useSSE
      2. Assert: All tests pass
      3. Assert: Test includes "liveness timeout" or "stale connection" case
    Expected Result: Hook falls back to polling when SSE goes silent
  ```

  **Commit**: YES
  - Message: `fix(sse): add liveness detection to prevent silent connection failures`
  - Files: `src/client/src/hooks/useSSE.ts`, `src/client/src/hooks/__tests__/useSSE.test.ts`
  - Pre-commit: `cd src/client && bun run test useSSE`

---

- [x] 1. Fix completion event bug (only emit for status="completed")

  **What to do**:
  - Write test for `synthesizeActivityItems()` that verifies:
    - Session with status="waiting" produces NO "agent-complete" item
    - Session with status="completed" DOES produce "agent-complete" item
    - Session with status="working" produces NO "agent-complete" item
    - Session with status="idle" produces NO "agent-complete" item
  - Change line 44 from:
    ```typescript
    if (session.status && session.status !== "working" && session.status !== "idle")
    ```
    to:
    ```typescript
    if (session.status === "completed")
    ```
  - Verify tests pass

  **Must NOT do**:
  - Do NOT change the AgentCompleteActivity type
  - Do NOT add new status types

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line change with clear test criteria
  - **Skills**: `[]`
    - No specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Tasks 2, 3, 4
  - **Blocked By**: None

  **References**:
  - `src/shared/utils/activityUtils.ts:44` - Bug location (condition includes "waiting")
  - `src/shared/types/index.ts:6` - SessionStatus type definition
  - `src/shared/types/index.ts:158` - AgentCompleteActivity interface

  **Acceptance Criteria**:

  - [ ] Test file exists: `src/shared/utils/__tests__/activityUtils.test.ts`
  - [ ] Test covers: session with status="waiting" → NO agent-complete item
  - [ ] Test covers: session with status="completed" → HAS agent-complete item
  - [ ] Test covers: session with status="working" → NO agent-complete item
  - [ ] `bun test src/shared/utils/__tests__/activityUtils.test.ts` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Verify no "Completed task (waiting)" in output
    Tool: Bash
    Steps:
      1. Run: bun test src/shared/utils/__tests__/activityUtils.test.ts
      2. Assert: All tests pass
      3. Assert: Test output includes "status=waiting should not create agent-complete"
    Expected Result: Tests pass, bug is fixed
  ```

  **Commit**: YES
  - Message: `fix(activity): only emit completion events for status=completed`
  - Files: `src/shared/utils/activityUtils.ts`, `src/shared/utils/__tests__/activityUtils.test.ts`
  - Pre-commit: `bun test src/shared/utils/__tests__/activityUtils.test.ts`

---

- [x] 2. Enhanced delegate_task display in formatCurrentAction

  **What to do**:
  - Write test for `formatCurrentAction()` with delegate_task inputs:
    - `{tool: "task", input: {description: "Explore codebase", subagent_type: "explore"}}` → "Explore codebase (explore)"
    - `{tool: "task", input: {subagent_type: "librarian"}}` → "Delegating (librarian)"
    - `{tool: "task", input: {}}` → "Delegating task"
    - `{tool: "delegate_task", input: {...}}` → Same behavior (handle both names)
  - Add handler in `formatCurrentAction()` after line 176, before `if (part.title)`:
    ```typescript
    // Handle delegate_task (tool name is "task" or "delegate_task")
    if (part.tool === "task" || part.tool === "delegate_task") {
      const input = part.input as { description?: string; subagent_type?: string } | undefined;
      const desc = input?.description;
      const agentType = input?.subagent_type;
      if (desc && agentType) return `${desc} (${agentType})`;
      if (desc) return desc;
      if (agentType) return `Delegating (${agentType})`;
      return "Delegating task";
    }
    ```
  - Verify tests pass

  **Must NOT do**:
  - Do NOT change ToolInput interface
  - Do NOT add async operations
  - Do NOT truncate description (keep it readable)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small addition to existing function
  - **Skills**: `[]`
    - No specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:
  - `src/server/storage/partParser.ts:151-184` - formatCurrentAction function
  - `src/shared/types/index.ts:65-72` - ToolInput interface with index signature
  - Actual part file example: delegate_task has `input.description`, `input.subagent_type`

  **Acceptance Criteria**:

  - [ ] Test file: `src/server/storage/__tests__/partParser.test.ts` (add new tests)
  - [ ] Test covers: delegate_task with description + subagent_type
  - [ ] Test covers: delegate_task with only subagent_type
  - [ ] Test covers: delegate_task with neither
  - [ ] `bun test src/server/storage/__tests__/partParser.test.ts` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Verify delegate_task formatting
    Tool: Bash
    Steps:
      1. Run: bun test src/server/storage/__tests__/partParser.test.ts
      2. Assert: All tests pass
      3. Assert: Test output includes "delegate_task" test cases
    Expected Result: delegate_task shows "Description (agent-type)" format
  ```

  **Commit**: YES
  - Message: `feat(activity): improve delegate_task display with description and agent type`
  - Files: `src/server/storage/partParser.ts`, `src/server/storage/__tests__/partParser.test.ts`
  - Pre-commit: `bun test src/server/storage/__tests__/partParser.test.ts`

---

- [x] 3. Enhanced todowrite/todoread display in formatCurrentAction

  **What to do**:
  - Write tests for `formatCurrentAction()` with todo inputs:
    - `{tool: "todowrite", input: {todos: [{content: "Setup"}, {content: "Build"}, {content: "Test"}]}}` → "Updated 3 todos: Setup, Build..."
    - `{tool: "todowrite", input: {todos: []}}` → "Cleared todos"
    - `{tool: "todowrite", input: {todos: [{content: "A very long todo item that exceeds thirty chars"}]}}` → Content truncated at 30 chars
    - `{tool: "todoread", input: {}}}` → "Reading todos"
  - Add handlers in `formatCurrentAction()` after delegate_task handler:
    ```typescript
    // Handle todowrite
    if (part.tool === "todowrite") {
      const input = part.input as { todos?: Array<{ content?: string }> } | undefined;
      const todos = input?.todos;
      if (!todos || todos.length === 0) return "Cleared todos";
      const preview = todos
        .slice(0, 2)
        .map(t => (t.content || "").slice(0, 30))
        .filter(Boolean)
        .join(", ");
      return `Updated ${todos.length} todos: ${preview}${todos.length > 2 ? "..." : ""}`;
    }

    // Handle todoread
    if (part.tool === "todoread") {
      return "Reading todos";
    }
    ```
  - Verify tests pass

  **Must NOT do**:
  - Do NOT show full todo content (truncate at 30 chars)
  - Do NOT show more than 2 preview items
  - Do NOT add interactive elements

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Similar pattern to Task 2
  - **Skills**: `[]`
    - No specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 4
  - **Blocked By**: Task 2

  **References**:
  - `src/server/storage/partParser.ts:151-184` - formatCurrentAction function
  - Actual part file: todowrite has `input.todos` array with `{content, status, id, priority}`

  **Acceptance Criteria**:

  - [ ] Tests added to: `src/server/storage/__tests__/partParser.test.ts`
  - [ ] Test covers: todowrite with multiple todos → preview format
  - [ ] Test covers: todowrite with empty todos array → "Cleared todos"
  - [ ] Test covers: todowrite with long content → truncated at 30 chars
  - [ ] Test covers: todoread → "Reading todos"
  - [ ] `bun test src/server/storage/__tests__/partParser.test.ts` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Verify todo formatting
    Tool: Bash
    Steps:
      1. Run: bun test src/server/storage/__tests__/partParser.test.ts
      2. Assert: All tests pass
      3. Assert: Test output includes todowrite and todoread test cases
    Expected Result: todowrite shows "Updated N todos: X, Y..." format
  ```

  **Commit**: YES
  - Message: `feat(activity): improve todowrite/todoread display with preview`
  - Files: `src/server/storage/partParser.ts`, `src/server/storage/__tests__/partParser.test.ts`
  - Pre-commit: `bun test src/server/storage/__tests__/partParser.test.ts`

---

- [x] 4. Verify auto-scroll behavior (user reports working)

  **What to do**:
  - User reports auto-scroll "kind of seems working right now"
  - Verify existing scroll behavior is correct
  - If issues found during testing, apply requestAnimationFrame fix
  - If working correctly, mark as verified (no changes needed)

  **Verification Steps**:
  1. Run existing ActivityStream tests
  2. If all pass and scroll logic looks correct, mark complete
  3. If flaky or issues found, apply rAF fix:
     ```typescript
     if (isAtBottom && scrollRef.current) {
       const scrollContainer = scrollRef.current;
       requestAnimationFrame(() => {
         scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
       });
     }
     ```

  **Must NOT do**:
  - Do NOT change working code unnecessarily
  - Do NOT refactor the entire scroll logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification task, may not need code changes
  - **Skills**: `[]`
    - No specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final task)
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:
  - `src/client/src/components/ActivityStream.tsx:47-50` - Current scroll logic
  - `src/client/src/components/__tests__/ActivityStreamUX.test.tsx` - Existing UX tests

  **Acceptance Criteria**:

  - [ ] Existing tests pass: `cd src/client && bun run test ActivityStream`
  - [ ] Scroll behavior verified (either working or fixed)
  - [ ] No regressions in scroll behavior

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Verify scroll fix doesn't break existing tests
    Tool: Bash
    Steps:
      1. Run: cd src/client && bun run test ActivityStream
      2. Assert: All tests pass
      3. Assert: No test failures related to scroll
    Expected Result: Tests pass, scroll timing fixed
  ```

  **Commit**: YES
  - Message: `fix(activity-stream): fix auto-scroll timing with requestAnimationFrame`
  - Files: `src/client/src/components/ActivityStream.tsx`
  - Pre-commit: `cd src/client && bun run test ActivityStream`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `fix(sse): add liveness detection to prevent silent connection failures` | useSSE.ts, tests | cd src/client && bun run test |
| 1 | `fix(activity): only emit completion events for status=completed` | activityUtils.ts, tests | bun test |
| 2 | `feat(activity): improve delegate_task display` | partParser.ts, tests | bun test |
| 3 | `feat(activity): improve todowrite/todoread display` | partParser.ts, tests | bun test |
| 4 | (verify only - commit if changes needed) | ActivityStream.tsx | cd src/client && bun run test |

---

## Success Criteria

### Verification Commands
```bash
# SSE hook tests pass (critical fix)
cd src/client && bun run test useSSE

# All shared utils tests pass
bun test src/shared/utils/__tests__/activityUtils.test.ts

# All parser tests pass
bun test src/server/storage/__tests__/partParser.test.ts

# All client tests pass
cd src/client && bun run test

# Type check passes
bun run tsc -b
```

### Final Checklist
- [x] **[CRITICAL]** Live view no longer freezes - SSE liveness detection works
- [x] No "Completed task (waiting)" appears in Activity Stream
- [x] delegate_task shows "Description (agent-type)" format
- [x] todowrite shows "Updated N todos: X, Y..." format
- [x] todoread shows "Reading todos"
- [x] Auto-scroll works when at bottom with new items
- [x] All tests pass
- [x] No TypeScript errors
