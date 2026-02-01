# Agent Status Display Improvement

## TL;DR

> **Quick Summary**: Fix stale spinners, add "waiting" state for parents blocked on children, and replace vague "Thinking..." with actual tool activity text.
> 
> **Deliverables**:
> - Fixed status calculation that uses tool completion state
> - New "waiting" status for parent sessions
> - Activity text showing actual tool calls (e.g., "bash: npm test...")
> - Updated both LiveActivity and SessionList components
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (types) → Task 2 (server logic) → Task 4 (LiveActivity) → Task 5 (SessionList)

---

## Context

### Original Request
User reported agent status display showing "wonky working/loading phases":
1. Spinner continues ~10+ seconds after agent finishes (tool calls complete)
2. Parent shows "idle" while children are actively working

### Interview Summary
**Key Discussions**:
- User knows agent finished when tool calls stop, not by time
- Wants new "waiting" state for parents blocked on children (hollow circle)
- Replace "Thinking..." with actual tool activity: `tool: context...` format
- 5-second grace period after tool completion before switching to idle
- Apply changes to BOTH LiveActivity and SessionList components
- TDD approach

**Research Findings**:
- **Root cause #1**: `hasPendingToolCall` parameter is NEVER passed to `getSessionStatus()` - always defaults to `false`
- **Root cause #2**: `isPendingToolCall()` function exists but is unused
- **Existing but unused**: `formatCurrentAction()` in `partParser.ts` already formats tool activity
- Current status purely time-based: <30s=working, 30s-5min=idle, >5min=completed
- Each session calculates status independently with no parent/child awareness

### Metis Review
**Identified Gaps** (addressed):
- Need way to get parts for session without scanning 25k+ files → use message partIDs
- `part.state` might be undefined → treat as "completed" (safe default)
- Deeply nested hierarchy → only check direct children for "waiting"
- Circular parent references → guard with parentID !== id check

---

## Work Objectives

### Core Objective
Make agent status indicators accurately reflect actual agent state by using tool completion signals and parent/child relationships instead of purely time-based thresholds.

### Concrete Deliverables
- `SessionStatus` type includes "waiting"
- `getSessionStatus()` uses actual pending tool state
- New `getPartsForSession()` function (without scanning 25k files)
- Parent sessions show "waiting on N agents" when children work
- Activity text shows real tool calls (using existing `formatCurrentAction()`)
- 5-second grace period after tool completion
- LiveActivity component with new states and activity text
- SessionList component with matching updates

### Definition of Done
- [x] `bun test` passes with new status logic tests
- [x] `cd src/client && bun run test` passes with component tests
- [x] Spinner stops within 7s of tool completion (5s grace + 2s poll)
- [x] Parent with working children shows hollow circle + "waiting on N agents"
- [x] Activity text shows actual tool calls in `tool: context...` format

### Must Have
- Status uses actual tool completion, not just timestamps
- "waiting" state for parents blocked on children
- Activity text replaces "Thinking..."
- Both LiveActivity and SessionList updated

### Must NOT Have (Guardrails)
- **NO scanning part directory** - 25k+ files anti-pattern
- **NO WebSocket** - keep HTTP polling
- **NO state persistence** - calculate from timestamps (stateless)
- **NO poll interval change** - keep 2s minimum
- **NO progress bars or durations** for tool activity
- **NO child details in waiting** - just count "waiting on N agents"
- **NO transition animations** - state snaps immediately
- **NO configuration for grace period** - hardcode 5s
- **NO recursive grandchild checking** - only direct children

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (bun test for server, vitest for client)
- **User wants tests**: TDD
- **Framework**: bun test (server), vitest (client)

### TDD Structure

Each task follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add "waiting" to SessionStatus type
└── Task 3: Add getPartsForSession() function

Wave 2 (After Wave 1):
├── Task 2: Update getSessionStatus() with full logic
└── Task 4: Update LiveActivity component (depends: types)

Wave 3 (After Wave 2):
└── Task 5: Update SessionList component (depends: LiveActivity patterns)

Critical Path: Task 1 → Task 2 → Task 4 → Task 5
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 4, 5 | 3 |
| 2 | 1, 3 | 4, 5 | None |
| 3 | None | 2 | 1 |
| 4 | 1, 2 | 5 | None |
| 5 | 4 | None | None |

---

## TODOs

- [x] 1. Add "waiting" to SessionStatus type and update interfaces

  **What to do**:
  - Add "waiting" to `SessionStatus` union type
  - Add `lastToolCompletedAt?: Date` to `ActivitySession` interface
  - Add `workingChildCount?: number` to `ActivitySession` interface
  - Ensure backwards compatibility (waiting is optional state)

  **Must NOT do**:
  - Change existing status values
  - Add UI-specific fields to shared types

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple type definition changes, single file, <20 lines
  - **Skills**: [`git-master`]
    - `git-master`: Clean atomic commit for type changes
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI work in this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Tasks 2, 4, 5
  - **Blocked By**: None (can start immediately)

  **References**:
  
  **Pattern References**:
  - `src/shared/types/index.ts:1-10` - Existing SessionStatus type definition
  - `src/shared/types/index.ts:45-60` - ActivitySession interface structure

  **Test References**:
  - `src/server/__tests__/sessionStatus.test.ts` - How status types are tested

  **WHY Each Reference Matters**:
  - Types file shows existing pattern for union types and interfaces
  - Test file shows how to verify type compatibility

  **Acceptance Criteria**:

  **TDD Tests** (write these FIRST):
  ```typescript
  // src/shared/types/__tests__/types.test.ts
  import type { SessionStatus, ActivitySession } from '../index';
  
  describe('SessionStatus type', () => {
    it('should include waiting as valid status', () => {
      const status: SessionStatus = 'waiting';
      expect(['working', 'idle', 'completed', 'waiting']).toContain(status);
    });
  });
  
  describe('ActivitySession interface', () => {
    it('should accept workingChildCount', () => {
      const session: ActivitySession = {
        id: 'test',
        title: 'Test',
        agent: 'sisyphus',
        createdAt: new Date(),
        updatedAt: new Date(),
        workingChildCount: 3,
      };
      expect(session.workingChildCount).toBe(3);
    });
  });
  ```

  **Automated Verification**:
  ```bash
  bun test src/shared/types
  # Assert: All tests pass
  
  bun run tsc -b --noEmit
  # Assert: No type errors, exit code 0
  ```

  **Commit**: YES
  - Message: `feat(types): add waiting status and child count fields`
  - Files: `src/shared/types/index.ts`, `src/shared/types/__tests__/types.test.ts`
  - Pre-commit: `bun test src/shared`

---

- [x] 2. Update getSessionStatus() with tool completion and waiting logic

  **What to do**:
  - Actually pass `hasPendingToolCall` (currently always false!)
  - Add `lastToolCompletedAt` parameter for grace period
  - Add `workingChildCount` parameter for waiting state
  - Implement status precedence: pending tools → waiting → grace period → time-based
  - Use existing `isPendingToolCall()` function (it exists but unused!)
  - 5-second grace period logic: if `(now - lastToolCompletedAt) < 5000ms` → "working"

  **Must NOT do**:
  - Change the 5-minute completed threshold
  - Persist any state (must be stateless calculation)
  - Break backwards compatibility (parameters should have defaults)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Core logic change with multiple conditions, needs careful implementation
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commits, may need to iterate
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Backend-only task

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 2)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: Tasks 1, 3

  **References**:

  **Pattern References**:
  - `src/server/utils/sessionStatus.ts:1-60` - Entire current implementation (READ COMPLETELY)
  - `src/server/utils/sessionStatus.ts:60-62` - `isPendingToolCall()` function (exists but UNUSED)

  **API/Type References**:
  - `src/shared/types/index.ts:SessionStatus` - Updated type with "waiting"
  - `src/server/storage/partParser.ts:PartMeta` - Part state field

  **Test References**:
  - `src/server/__tests__/sessionStatus.test.ts` - Existing tests to extend

  **WHY Each Reference Matters**:
  - Current sessionStatus.ts shows all existing logic that must be preserved
  - `isPendingToolCall()` already exists - USE IT, don't recreate
  - Test file shows testing patterns to follow

  **Acceptance Criteria**:

  **TDD Tests** (write these FIRST):
  ```typescript
  // Add to src/server/__tests__/sessionStatus.test.ts
  
  describe('getSessionStatus with tool state', () => {
    it('returns working when hasPendingToolCall is true regardless of time', () => {
      const oldMessages = [createMessage(10 * 60 * 1000)]; // 10 min old
      expect(getSessionStatus(oldMessages, true)).toBe('working');
    });
    
    it('returns working during grace period after tool completion', () => {
      const messages = [createMessage(10 * 1000)]; // 10s old
      const lastToolCompletedAt = new Date(Date.now() - 3000); // 3s ago
      expect(getSessionStatus(messages, false, lastToolCompletedAt)).toBe('working');
    });
    
    it('returns idle after grace period expires', () => {
      const messages = [createMessage(10 * 1000)]; // 10s old
      const lastToolCompletedAt = new Date(Date.now() - 6000); // 6s ago
      expect(getSessionStatus(messages, false, lastToolCompletedAt)).toBe('idle');
    });
    
    it('returns waiting when workingChildCount > 0', () => {
      const messages = [createMessage(60 * 1000)]; // 60s old (would be idle)
      expect(getSessionStatus(messages, false, undefined, 3)).toBe('waiting');
    });
    
    it('waiting takes precedence over idle', () => {
      const messages = [createMessage(60 * 1000)]; // 60s old
      expect(getSessionStatus(messages, false, undefined, 1)).toBe('waiting');
    });
  });
  ```

  **Automated Verification**:
  ```bash
  bun test src/server/__tests__/sessionStatus.test.ts
  # Assert: All tests pass including new ones
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `feat(status): add tool completion, grace period, and waiting logic`
  - Files: `src/server/utils/sessionStatus.ts`, `src/server/__tests__/sessionStatus.test.ts`
  - Pre-commit: `bun test src/server/__tests__/sessionStatus`

---

- [x] 3. Add getPartsForSession() function to get tool state without scanning

  **What to do**:
  - Add function to get parts referenced by a session's messages
  - Use message data to find part IDs (avoid scanning part/ directory!)
  - Return array of PartMeta with state info
  - Add helper to determine `hasPendingToolCall` and `lastToolCompletedAt` from parts
  - Integrate with existing `isPendingToolCall()` function

  **Must NOT do**:
  - Scan the part/ directory (25k+ files anti-pattern)
  - Load ALL parts - only load what's referenced
  - Add caching/persistence

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Need to understand message→part relationship, careful implementation
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: Will be used but not primary skill needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/server/storage/partParser.ts:1-170` - Existing part parsing, `formatCurrentAction()`, `isPendingToolCall()`
  - `src/server/storage/messageParser.ts:1-80` - Message parsing, may have part references

  **API/Type References**:
  - `src/shared/types/index.ts:PartMeta` - Part interface with state field
  - `src/server/storage/partParser.ts:parsePart` - How to load individual parts

  **Documentation References**:
  - Check actual message JSON files in `~/.local/share/Claude/storage/message/` for part reference structure

  **WHY Each Reference Matters**:
  - partParser.ts has ALL the building blocks - just need to orchestrate
  - messageParser.ts shows how messages are structured, may have partIDs array
  - Must understand actual storage format to avoid scanning

  **Acceptance Criteria**:

  **TDD Tests** (write these FIRST):
  ```typescript
  // src/server/storage/__tests__/partParser.test.ts (add or create)
  
  describe('getSessionToolState', () => {
    it('returns hasPendingToolCall true when any tool is pending', () => {
      const parts: PartMeta[] = [
        { id: 'p1', type: 'tool', tool: 'bash', state: 'complete' },
        { id: 'p2', type: 'tool', tool: 'read', state: 'pending' },
      ];
      const result = getSessionToolState(parts);
      expect(result.hasPendingToolCall).toBe(true);
    });
    
    it('returns lastToolCompletedAt from most recent completed tool', () => {
      // Test with parts that have completion timestamps
    });
    
    it('returns hasPendingToolCall false when all tools complete', () => {
      const parts: PartMeta[] = [
        { id: 'p1', type: 'tool', tool: 'bash', state: 'complete' },
        { id: 'p2', type: 'tool', tool: 'read', state: 'complete' },
      ];
      const result = getSessionToolState(parts);
      expect(result.hasPendingToolCall).toBe(false);
    });
  });
  ```

  **Automated Verification**:
  ```bash
  bun test src/server/storage/__tests__/partParser.test.ts
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(parts): add getSessionToolState for pending tool detection`
  - Files: `src/server/storage/partParser.ts`, `src/server/storage/__tests__/partParser.test.ts`
  - Pre-commit: `bun test src/server/storage`

---

- [x] 4. Update LiveActivity component with new status states and activity text

  **What to do**:
  - Add "waiting" status visual: hollow/outline circle icon
  - Show child count text: "waiting on N agents"
  - Replace "Thinking..." with actual activity text from `currentAction`
  - Format: `tool: context...` (with ellipsis) for running, `tool: context` for done
  - Use existing `formatCurrentAction()` output from server (already formatted!)
  - Add suffix ellipsis for running tools (state !== 'complete')

  **Must NOT do**:
  - Add progress bars or durations
  - Show child details beyond count
  - Add transition animations

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with visual states, icons, and styling
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Visual component implementation
  - **Skills Evaluated but Omitted**:
    - `playwright`: Testing will be simpler component tests first

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 2)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/client/src/components/LiveActivity.tsx:1-200` - ENTIRE current component
  - `src/client/src/components/LiveActivity.tsx:StatusIndicator` - Current icon switching logic
  - `src/server/storage/partParser.ts:formatCurrentAction` - Format already implemented server-side!

  **API/Type References**:
  - `src/shared/types/index.ts:ActivitySession` - Has `currentAction` field to display
  - `lucide-react` - For Circle icon (hollow version)

  **Test References**:
  - `src/client/src/__tests__/` - Component test patterns

  **WHY Each Reference Matters**:
  - LiveActivity.tsx is the exact file to modify
  - StatusIndicator shows pattern for icon switching
  - formatCurrentAction already does the hard work - just display it!

  **Acceptance Criteria**:

  **TDD Tests** (write these FIRST):
  ```typescript
  // src/client/src/__tests__/LiveActivity.test.tsx
  
  describe('LiveActivity StatusIndicator', () => {
    it('renders hollow circle for waiting status', () => {
      render(<StatusIndicator status="waiting" />);
      expect(screen.getByTestId('status-waiting')).toBeInTheDocument();
    });
    
    it('shows child count for waiting status', () => {
      render(<ActivityRow session={{ status: 'waiting', workingChildCount: 3 }} />);
      expect(screen.getByText('waiting on 3 agents')).toBeInTheDocument();
    });
    
    it('shows activity text instead of Thinking...', () => {
      render(<ActivityRow session={{ status: 'working', currentAction: 'bash: npm test...' }} />);
      expect(screen.getByText('bash: npm test...')).toBeInTheDocument();
      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
    });
  });
  ```

  **Automated Verification**:
  ```bash
  cd src/client && bun run test -- --run LiveActivity
  # Assert: All tests pass
  
  # Visual verification via Playwright:
  # 1. Start dev server
  # 2. Navigate to dashboard with active session
  # 3. Assert: working sessions show spinner + activity text
  # 4. Assert: waiting sessions show hollow circle + "waiting on N agents"
  # 5. Screenshot: .sisyphus/evidence/task-4-liveactivity.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add waiting status and activity text to LiveActivity`
  - Files: `src/client/src/components/LiveActivity.tsx`, `src/client/src/__tests__/LiveActivity.test.tsx`
  - Pre-commit: `cd src/client && bun run test -- --run LiveActivity`

---

- [x] 5. Update SessionList component with matching status changes

  **What to do**:
  - Mirror LiveActivity changes to SessionList sidebar
  - Add "waiting" status with hollow circle
  - Show activity text in session item
  - Keep consistent visual language with LiveActivity

  **Must NOT do**:
  - Diverge from LiveActivity patterns
  - Add features not in LiveActivity

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component, needs visual consistency with LiveActivity
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UI consistency
  - **Skills Evaluated but Omitted**:
    - N/A

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 3 - final)
  - **Blocks**: None (final task)
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `src/client/src/components/SessionList.tsx:1-150` - Current component
  - `src/client/src/components/LiveActivity.tsx:StatusIndicator` - Pattern to follow from Task 4

  **WHY Each Reference Matters**:
  - SessionList.tsx is the file to modify
  - LiveActivity.tsx (after Task 4) provides the exact patterns to copy

  **Acceptance Criteria**:

  **TDD Tests** (write these FIRST):
  ```typescript
  // src/client/src/__tests__/SessionList.test.tsx
  
  describe('SessionList StatusIcon', () => {
    it('renders hollow circle for waiting status', () => {
      render(<SessionItem session={{ status: 'waiting' }} />);
      expect(screen.getByTestId('session-status-waiting')).toBeInTheDocument();
    });
    
    it('shows activity text for working sessions', () => {
      render(<SessionItem session={{ status: 'working', currentAction: 'read: index.ts...' }} />);
      expect(screen.getByText('read: index.ts...')).toBeInTheDocument();
    });
  });
  ```

  **Automated Verification**:
  ```bash
  cd src/client && bun run test -- --run SessionList
  # Assert: All tests pass
  
  # Full test suite:
  cd src/client && bun run test
  # Assert: All component tests pass
  ```

  **Commit**: YES
  - Message: `feat(ui): add waiting status and activity text to SessionList`
  - Files: `src/client/src/components/SessionList.tsx`, `src/client/src/__tests__/SessionList.test.tsx`
  - Pre-commit: `cd src/client && bun run test -- --run SessionList`

---

- [x] 6. Integrate status logic in server endpoints

  **What to do**:
  - Update `/api/poll` to actually pass `hasPendingToolCall` to `getSessionStatus()`
  - Calculate `workingChildCount` in `getSessionHierarchy()`
  - Use `formatCurrentAction()` to set `currentAction` field
  - Add `lastToolCompletedAt` calculation from parts

  **Must NOT do**:
  - Add new endpoints
  - Change polling interval
  - Add WebSocket

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple integration points, needs careful orchestration
  - **Skills**: [`git-master`]
    - `git-master`: May need careful commits
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Backend-only

  **Parallelization**:
  - **Can Run In Parallel**: NO (should run after Task 2, 3)
  - **Parallel Group**: Can run parallel with Task 4 if deps met
  - **Blocks**: None
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/server/index.ts:306-386` - `getSessionHierarchy()` function
  - `src/server/index.ts:489-515` - `/api/poll` status calculation (CURRENTLY BROKEN)
  - `src/server/storage/partParser.ts:formatCurrentAction` - Use this!

  **WHY Each Reference Matters**:
  - index.ts shows exactly where status is calculated and where it's broken
  - formatCurrentAction is ready to use - just need to call it

  **Acceptance Criteria**:

  **TDD Tests**:
  ```typescript
  // src/server/__tests__/poll.test.ts (extend existing)
  
  describe('/api/poll with tool state', () => {
    it('returns working status for session with pending tool', async () => {
      // Mock session with pending tool call
      const res = await app.request('/api/poll');
      const data = await res.json();
      const workingSession = data.activitySessions.find(s => /* has pending tool */);
      expect(workingSession.status).toBe('working');
    });
    
    it('returns waiting status for parent with working children', async () => {
      // Mock parent with working child
      const res = await app.request('/api/poll');
      const data = await res.json();
      const parent = data.activitySessions.find(s => /* has working children */);
      expect(parent.status).toBe('waiting');
      expect(parent.workingChildCount).toBeGreaterThan(0);
    });
    
    it('returns currentAction from formatCurrentAction', async () => {
      const res = await app.request('/api/poll');
      const data = await res.json();
      const workingSession = data.activitySessions.find(s => s.status === 'working');
      expect(workingSession.currentAction).toMatch(/\w+:/); // "tool: context" format
    });
  });
  ```

  **Automated Verification**:
  ```bash
  bun test src/server/__tests__/poll.test.ts
  # Assert: All tests pass
  
  # Integration test:
  bun test src/__tests__/integration.test.ts
  # Assert: Full flow works
  ```

  **Commit**: YES
  - Message: `feat(server): integrate tool state and waiting logic in poll endpoint`
  - Files: `src/server/index.ts`
  - Pre-commit: `bun test src/server`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(types): add waiting status and child count fields` | types/index.ts | `bun run tsc -b` |
| 2 | `feat(status): add tool completion, grace period, and waiting logic` | sessionStatus.ts | `bun test sessionStatus` |
| 3 | `feat(parts): add getSessionToolState for pending tool detection` | partParser.ts | `bun test partParser` |
| 4 | `feat(ui): add waiting status and activity text to LiveActivity` | LiveActivity.tsx | `cd src/client && bun run test` |
| 5 | `feat(ui): add waiting status and activity text to SessionList` | SessionList.tsx | `cd src/client && bun run test` |
| 6 | `feat(server): integrate tool state and waiting logic in poll endpoint` | index.ts | `bun test` |

---

## Success Criteria

### Verification Commands
```bash
# Type check
bun run tsc -b --noEmit
# Expected: No errors

# Server tests
bun test
# Expected: All pass

# Client tests
cd src/client && bun run test
# Expected: All pass

# Integration test
bun test src/__tests__/integration.test.ts
# Expected: All pass
```

### Final Checklist
- [x] All "Must Have" present:
  - [x] Status uses actual tool completion
  - [x] "waiting" state for parents blocked on children
  - [x] Activity text replaces "Thinking..."
  - [x] Both LiveActivity and SessionList updated
- [x] All "Must NOT Have" absent:
  - [x] No part directory scanning
  - [x] No WebSocket
  - [x] No state persistence
  - [x] No poll interval change
- [x] All tests pass
- [x] Spinner stops within 7s of tool completion
- [x] Parent with working children shows hollow circle + "waiting on N agents"
