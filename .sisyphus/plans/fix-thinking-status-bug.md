# Fix "Thinking..." Status Bug

## TL;DR

> **Quick Summary**: Fix dashboard incorrectly showing "Thinking..." when the OpenCode agent has finished its turn and is waiting for user input. Use the `finish` field from message JSON to detect completed turns.
> 
> **Deliverables**:
> - Updated MessageMeta type with `finish` field
> - Modified status detection to check for `finish === "stop"`
> - UI shows "Waiting for input" instead of "Thinking..." when agent is done
> 
> **Estimated Effort**: Short (4-6 tasks, ~30-45 min)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6

---

## Context

### Original Request
Fix the dashboard showing "Thinking..." status when the agent has actually finished working and is waiting for user input.

### Interview Summary
**Key Discussions**:
- Root cause: Time-based status logic returns "working" for messages < 30s old, even when agent finished
- Solution: Use `finish` field from message JSON to detect completed assistant turns
- `finish === "stop"` means agent is done; `finish === "tool-calls"` means still processing

**Research Findings**:
- MessageJSON already has `finish?: string` defined but not extracted
- `finish` values observed: `"stop"` (done), `"tool-calls"` (still working)
- Current status precedence doesn't account for completed assistant turns
- UI line 103-105 in LiveActivity.tsx shows "Thinking..." for working status

### Metis Review
**Identified Gaps** (addressed):
- What values can `finish` have? → Verified: "stop" and "tool-calls" observed
- Only `finish === "stop"` should trigger waiting status
- `finish === "tool-calls"` means agent is still working (waiting for tool results)
- Edge case: pending tool call should still override finish status

---

## Work Objectives

### Core Objective
Detect when an assistant has completed its turn (via `finish === "stop"`) and show "waiting" status with "Waiting for input" text instead of "working" with "Thinking...".

### Concrete Deliverables
- `src/shared/types/index.ts` - MessageMeta with `finish?: string`
- `src/server/storage/messageParser.ts` - Extract `finish` field
- `src/server/utils/sessionStatus.ts` - New `lastAssistantFinished` parameter and priority
- `src/server/index.ts` - Compute and pass `lastAssistantFinished`
- `src/client/src/components/LiveActivity.tsx` - "Waiting for input" text
- `src/server/__tests__/sessionStatus.test.ts` - New test cases

### Definition of Done
- [ ] `bun test` passes all tests including new ones
- [ ] `bun run tsc -b` compiles without errors
- [ ] When agent finishes turn with `finish === "stop"`, UI shows "Waiting for input"
- [ ] When agent has pending tool calls, UI still shows "Thinking..." or tool action

### Must Have
- Parse `finish` field from message JSON
- New status priority: `lastAssistantFinished && !hasPendingToolCall` → "waiting"
- UI text "Waiting for input" for waiting status without working children
- Test coverage for new behavior

### Must NOT Have (Guardrails)
- DO NOT add new status values (keep "working" | "idle" | "completed" | "waiting")
- DO NOT change status indicator icons/colors
- DO NOT modify status logic for `finish === "tool-calls"` (that stays as "working")
- DO NOT break backwards compatibility with existing API
- DO NOT touch files beyond the 6 specified

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (`bun test` with Bun's built-in runner)
- **User wants tests**: YES (TDD - add test cases before/with implementation)
- **Framework**: bun test

### Automated Verification

**Backend tests:**
```bash
bun test src/server/__tests__/sessionStatus.test.ts
# Expected: All tests pass, including new "assistant finished" tests
```

**Type checking:**
```bash
bun run tsc -b
# Expected: Exit 0, no errors
```

**Integration verification:**
```bash
bun test
# Expected: All tests pass
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add finish field to MessageMeta type [no dependencies]
└── Task 2: Parse finish field in messageParser [no dependencies]

Wave 2 (After Wave 1):
├── Task 3: Update sessionStatus with new priority [depends: 1]
└── Task 4: Update index.ts to pass lastAssistantFinished [depends: 1, 2, 3]

Wave 3 (After Wave 2):
├── Task 5: Update LiveActivity UI text [depends: 3]
└── Task 6: Add tests for new behavior [depends: 3]

Critical Path: Task 1 → Task 3 → Task 4 → Task 6
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4 | 2 |
| 2 | None | 4 | 1 |
| 3 | 1 | 4, 5, 6 | None |
| 4 | 1, 2, 3 | None | 5, 6 |
| 5 | 3 | None | 4, 6 |
| 6 | 3 | None | 4, 5 |

---

## TODOs

- [ ] 1. Add `finish` field to MessageMeta type

  **What to do**:
  - Open `src/shared/types/index.ts`
  - Add `finish?: string;` to MessageMeta interface (after `createdAt: Date;`)
  - This is a simple one-line addition

  **Must NOT do**:
  - DO NOT add finish to other interfaces (only MessageMeta)
  - DO NOT change any existing field types

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-line type addition, trivial change
  - **Skills**: None needed
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed for simple edit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: None (can start immediately)

  **References**:
  - `src/shared/types/index.ts:26-37` - MessageMeta interface definition
  - Pattern: Follow existing optional field style (e.g., `agent?: string;` on line 30)

  **Acceptance Criteria**:
  - [ ] `bun run tsc -b` compiles without errors
  - [ ] MessageMeta interface has `finish?: string;` field

  **Commit**: NO (groups with Task 2)

---

- [ ] 2. Parse `finish` field in messageParser

  **What to do**:
  - Open `src/server/storage/messageParser.ts`
  - In `parseMessage()` function (line 53-82), add `finish: json.finish,` to the returned object
  - Add it after `createdAt: new Date(json.time.created),` (around line 74)

  **Must NOT do**:
  - DO NOT change the MessageJSON interface (it already has `finish`)
  - DO NOT modify other fields or parsing logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-line addition to existing function
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:
  - `src/server/storage/messageParser.ts:45` - MessageJSON already has `finish?: string`
  - `src/server/storage/messageParser.ts:64-75` - Returned object where finish should be added
  - Pattern: Follow existing field extraction (e.g., line 69: `agent: json.agent,`)

  **Acceptance Criteria**:
  - [ ] `bun run tsc -b` compiles without errors
  - [ ] parseMessage() returns object with `finish` field from JSON

  **Commit**: YES
  - Message: `feat(server): parse finish field from message JSON`
  - Files: `src/shared/types/index.ts`, `src/server/storage/messageParser.ts`
  - Pre-commit: `bun run tsc -b`

---

- [ ] 3. Update sessionStatus with new priority check

  **What to do**:
  - Open `src/server/utils/sessionStatus.ts`
  - Add new parameter to `getSessionStatus()`: `lastAssistantFinished?: boolean`
  - Add new Priority 1.5 check after pending tool (line 39), before working children (line 42):
    ```typescript
    // Priority 1.5: Assistant finished turn (waiting for user input)
    if (lastAssistantFinished && !hasPendingToolCall) {
      return "waiting";
    }
    ```
  - Update JSDoc comment to document new parameter and priority

  **Must NOT do**:
  - DO NOT change existing priority logic order (1, 2, 3, 4)
  - DO NOT modify thresholds or other parameters
  - DO NOT change return type or status values

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small logic addition with clear pattern
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential after Wave 1)
  - **Blocks**: Tasks 4, 5, 6
  - **Blocked By**: Task 1 (needs updated type)

  **References**:
  - `src/server/utils/sessionStatus.ts:30-35` - Function signature to update
  - `src/server/utils/sessionStatus.ts:36-44` - Where to insert new priority
  - `src/server/utils/sessionStatus.ts:15-28` - JSDoc to update
  - Pattern: Follow existing priority pattern (lines 36-44 for structure)

  **Acceptance Criteria**:
  - [ ] getSessionStatus() accepts new `lastAssistantFinished?: boolean` parameter
  - [ ] Returns "waiting" when lastAssistantFinished=true AND hasPendingToolCall=false
  - [ ] Still returns "working" when hasPendingToolCall=true (even if finished)
  - [ ] `bun run tsc -b` compiles without errors

  **Commit**: YES
  - Message: `feat(server): add lastAssistantFinished check to status detection`
  - Files: `src/server/utils/sessionStatus.ts`
  - Pre-commit: `bun run tsc -b`

---

- [ ] 4. Update index.ts to compute and pass lastAssistantFinished

  **What to do**:
  - Find all calls to `getSessionStatus()` in `src/server/index.ts`
  - For each call, compute `lastAssistantFinished`:
    1. Find the last assistant message in the session
    2. Check if `msg.finish === "stop"`
  - Pass this as the 5th parameter to `getSessionStatus()`
  - Key locations (from grep): lines 116, 201, 337, 347, 401, 468, 478, 576, 607

  **Must NOT do**:
  - DO NOT change the API response format
  - DO NOT modify other endpoint logic
  - DO NOT add `finish === "tool-calls"` as finished (only "stop")

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Multiple similar changes across file, requires careful attention
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after Task 3)
  - **Blocks**: None (final integration)
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - `src/server/index.ts:116` - First getSessionStatus call
  - `src/server/index.ts:337-352` - Example call with all parameters
  - `src/server/storage/messageParser.ts:151-167` - getFirstAssistantMessage pattern
  - Pattern: Check last assistant message's finish field before calling getSessionStatus

  **Helper pattern to compute lastAssistantFinished**:
  ```typescript
  // Find last assistant message and check if finish === "stop"
  const assistantMessages = messages.filter(m => m.role === "assistant");
  const lastAssistant = assistantMessages.length > 0 
    ? assistantMessages.reduce((a, b) => a.createdAt > b.createdAt ? a : b) 
    : null;
  const lastAssistantFinished = lastAssistant?.finish === "stop";
  ```

  **Acceptance Criteria**:
  - [ ] All getSessionStatus() calls pass lastAssistantFinished parameter
  - [ ] `bun run tsc -b` compiles without errors
  - [ ] When last assistant message has `finish === "stop"`, status is "waiting"

  **Commit**: YES
  - Message: `feat(server): pass lastAssistantFinished to status detection`
  - Files: `src/server/index.ts`
  - Pre-commit: `bun test src/server/__tests__/sessionStatus.test.ts`

---

- [ ] 5. Update LiveActivity UI to show "Waiting for input"

  **What to do**:
  - Open `src/client/src/components/LiveActivity.tsx`
  - Modify lines 99-106 to handle waiting status without children:
    ```typescript
    let currentActionText = session.currentAction;
    if (!currentActionText) {
      if (session.workingChildCount && session.workingChildCount > 0) {
        currentActionText = `waiting on ${session.workingChildCount} agents`;
      } else if (status === 'working') {
        currentActionText = 'Thinking...';
      } else if (status === 'waiting') {
        currentActionText = 'Waiting for input';
      }
    }
    ```

  **Must NOT do**:
  - DO NOT change StatusIndicator icons/colors
  - DO NOT modify other components
  - DO NOT change the status type

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small UI text change, clear pattern
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 4, 6)
  - **Blocks**: None
  - **Blocked By**: Task 3 (needs updated status logic)

  **References**:
  - `src/client/src/components/LiveActivity.tsx:99-106` - Current action text logic
  - `src/client/src/components/LiveActivity.tsx:78-83` - StatusIndicator for "waiting" (shows gray circle)
  - Pattern: Follow existing else-if chain structure

  **Acceptance Criteria**:
  - [ ] When status is "waiting" and no workingChildCount, shows "Waiting for input"
  - [ ] When status is "waiting" with workingChildCount, still shows "waiting on N agents"
  - [ ] `cd src/client && bun run tsc` compiles without errors

  **Commit**: YES
  - Message: `feat(client): show "Waiting for input" when agent finished turn`
  - Files: `src/client/src/components/LiveActivity.tsx`
  - Pre-commit: `bun run tsc -b`

---

- [ ] 6. Add tests for new behavior

  **What to do**:
  - Open `src/server/__tests__/sessionStatus.test.ts`
  - Add new describe block: `"getSessionStatus - assistant finished turn"`
  - Add test cases:
    1. Returns "waiting" when lastAssistantFinished=true and no pending tools
    2. Returns "working" when hasPendingToolCall=true even if finished
    3. Returns "waiting" even if message is old (finish overrides time-based)
    4. Returns time-based status when lastAssistantFinished=false

  **Must NOT do**:
  - DO NOT modify existing tests
  - DO NOT change test utilities

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Following existing test patterns, well-scoped
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 4, 5)
  - **Blocks**: None
  - **Blocked By**: Task 3 (tests the new functionality)

  **References**:
  - `src/server/__tests__/sessionStatus.test.ts:116-202` - Existing describe blocks as pattern
  - `src/server/__tests__/sessionStatus.test.ts:9-16` - createMessage helper
  - Pattern: Follow existing test structure with describe/test blocks

  **Test cases to add**:
  ```typescript
  describe("getSessionStatus - assistant finished turn", () => {
    test("returns 'waiting' when lastAssistantFinished=true and no pending tools", () => {
      const messages = [createMessage(10)]; // recent message
      expect(getSessionStatus(messages, false, undefined, 0, true)).toBe("waiting");
    });

    test("pending tool call overrides finished status", () => {
      const messages = [createMessage(10)];
      expect(getSessionStatus(messages, true, undefined, 0, true)).toBe("working");
    });

    test("finished status overrides time-based (returns waiting not idle)", () => {
      const messages = [createMessage(120)]; // 2 min ago (would be idle)
      expect(getSessionStatus(messages, false, undefined, 0, true)).toBe("waiting");
    });

    test("returns time-based when not finished", () => {
      const messages = [createMessage(10)]; // recent (would be working)
      expect(getSessionStatus(messages, false, undefined, 0, false)).toBe("working");
    });
  });
  ```

  **Acceptance Criteria**:
  - [ ] All new tests pass: `bun test src/server/__tests__/sessionStatus.test.ts`
  - [ ] Tests cover: finished→waiting, pending overrides finished, finish overrides time

  **Commit**: YES
  - Message: `test(server): add tests for assistant finished status detection`
  - Files: `src/server/__tests__/sessionStatus.test.ts`
  - Pre-commit: `bun test src/server/__tests__/sessionStatus.test.ts`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2 | `feat(server): parse finish field from message JSON` | types/index.ts, messageParser.ts | `bun run tsc -b` |
| 3 | `feat(server): add lastAssistantFinished check to status detection` | sessionStatus.ts | `bun run tsc -b` |
| 4 | `feat(server): pass lastAssistantFinished to status detection` | index.ts | `bun test` |
| 5 | `feat(client): show "Waiting for input" when agent finished turn` | LiveActivity.tsx | `bun run tsc -b` |
| 6 | `test(server): add tests for assistant finished status detection` | sessionStatus.test.ts | `bun test` |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
bun test
# Expected: All tests pass including new sessionStatus tests

# Type check
bun run tsc -b
# Expected: Exit 0, no errors

# Manual verification (after running server)
# 1. Start a session with OpenCode
# 2. Let agent complete a response
# 3. Check dashboard - should show "Waiting for input" not "Thinking..."
```

### Final Checklist
- [ ] MessageMeta has `finish?: string` field
- [ ] messageParser extracts `finish` from JSON
- [ ] getSessionStatus accepts `lastAssistantFinished` parameter
- [ ] Status is "waiting" when `finish === "stop"` and no pending tools
- [ ] Status is "working" when pending tools exist (even if finished)
- [ ] UI shows "Waiting for input" for waiting status without children
- [ ] All tests pass
- [ ] TypeScript compiles without errors
