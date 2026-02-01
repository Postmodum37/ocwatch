# LiveActivity Dashboard Fixes

## TL;DR

> **Quick Summary**: Fix two issues in OCWatch's LiveActivity dashboard: (1) sort subagents by most recent activity instead of oldest first, and (2) show separate root nodes when agents transition within the same session.
> 
> **Deliverables**:
> - Updated `buildSessionTree()` sorting logic in LiveActivity.tsx
> - New `detectAgentPhases()` helper function in index.ts
> - Modified `getSessionHierarchy()` to create virtual roots for agent phases
> - Updated tests for both changes
> 
> **Estimated Effort**: Medium (2-3 hours)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 2 → Task 3 → Task 5

---

## Context

### Original Request
Two fixes for the OCWatch LiveActivity dashboard:
1. Sort subagent children by most recent activity (`updatedAt` descending) instead of oldest first (`createdAt` ascending)
2. When agents transition within the same main session (e.g., prometheus → atlas via /start-work), show each agent as a separate root node with its respective child sessions

### Interview Summary
**Key Discussions**:
- Fix 1 is a simple client-side change in `buildSessionTree()` function
- Fix 2 requires server-side changes to detect agent phase transitions and create virtual root nodes
- Child sessions should be attributed to agent phases based on their `createdAt` timing relative to phase boundaries

**Research Findings**:
- `ActivitySession` type already has all needed fields (id, agent, parentID, tokens, status, createdAt, updatedAt)
- Messages have `agent` field that changes when different agents take over
- `getSessionHierarchy()` currently uses only the first assistant message to determine agent
- Existing test infrastructure: Vitest for client, Bun test for server

### Applied Defaults
**Defaults Applied** (sensible choices, override if needed):
- **Empty phases**: Show ALL agent phases, even those with no children (provides complete history)
- **Token attribution**: Sum tokens from phase's messages for virtual roots
- **Status determination**: Use phase's last message timestamp (consistent with existing behavior)
- **Virtual root IDs**: Format `{sessionId}-phase-{index}-{agent}` for uniqueness (agent can repeat)

---

## Work Objectives

### Core Objective
Fix the LiveActivity dashboard to (1) show most recently active subagents first and (2) display agent transitions as separate root nodes.

### Concrete Deliverables
- Modified `src/client/src/components/LiveActivity.tsx` - sorting logic
- Modified `src/server/index.ts` - agent phase detection and virtual roots
- Updated `src/client/src/components/__tests__/LiveActivity.test.tsx` - sorting tests
- New/updated server tests for agent phase detection

### Definition of Done
- [ ] Children sorted by `updatedAt` descending (most recent first)
- [ ] Agent transitions create separate root nodes
- [ ] All existing tests pass
- [ ] New tests cover agent phase detection
- [ ] Manual verification with multi-agent session

### Must Have
- Sorting uses `updatedAt` for all nodes (roots and children)
- Virtual roots created when 2+ agent phases detected in main session
- Child sessions attributed to correct phase based on timing
- Backward compatible: single-agent sessions work exactly as before

### Must NOT Have (Guardrails)
- No changes to `ActivitySession` type definition
- No UI changes to visually distinguish virtual roots (out of scope)
- No agent timeline/history visualization (out of scope)
- No breaking changes to `/api/poll` response structure (additive only)
- No modification of child session's actual `parentID` in storage (only in response)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest for client, Bun test for server)
- **User wants tests**: YES (Tests-after)
- **Framework**: Vitest (client), Bun test (server)
- **QA approach**: Automated tests + manual verification

### Automated Verification

**Client Tests (Vitest):**
```bash
cd src/client && bun run test -- --grep "LiveActivity"
```

**Server Tests (Bun):**
```bash
bun test src/server/__tests__/poll.test.ts
```

**Type Checking:**
```bash
bun run tsc -b
```

### Manual Verification Procedure
1. Start OCWatch: `bun run dev`
2. Open browser to http://localhost:5173
3. Select a session that has agent transitions (prometheus → atlas)
4. Verify: Two separate root nodes appear (prometheus, atlas)
5. Verify: Children grouped under correct parent by timing
6. Verify: Most recently active subagent appears first in each group

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Fix sorting in LiveActivity.tsx (client-side)
└── Task 2: Add detectAgentPhases() helper (server-side)

Wave 2 (After Wave 1):
├── Task 3: Modify getSessionHierarchy() for virtual roots (depends: 2)
├── Task 4: Update LiveActivity tests (depends: 1)
└── Task 5: Add server tests for phase detection (depends: 2, 3)

Wave 3 (After Wave 2):
└── Task 6: Manual verification and final checks (depends: all)

Critical Path: Task 2 → Task 3 → Task 5
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 4 | 2 |
| 2 | None | 3, 5 | 1 |
| 3 | 2 | 5, 6 | 4 |
| 4 | 1 | 6 | 3, 5 |
| 5 | 2, 3 | 6 | 4 |
| 6 | All | None | None (final) |

---

## TODOs

- [ ] 1. Fix sorting to use `updatedAt` descending for all nodes

  **What to do**:
  - Open `src/client/src/components/LiveActivity.tsx`
  - Locate `buildSessionTree()` function (lines 31-62)
  - Modify sorting logic in `sortNodes()` (lines 49-58)
  - Change from `createdAt` to `updatedAt`
  - Remove `isRoot` conditional - always sort descending (most recent first)

  **Must NOT do**:
  - Change any other logic in `buildSessionTree()`
  - Modify the `SessionNode` interface
  - Touch the rendering logic in `SessionRow`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple single-file change with clear before/after
  - **Skills**: None needed
    - Simple TypeScript edit, no special tooling required

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/client/src/components/LiveActivity.tsx:49-58` - Current sorting implementation to modify

  **Type References**:
  - `src/shared/types/index.ts:43-55` - `ActivitySession` type showing `updatedAt` field exists

  **Test References**:
  - `src/client/src/components/__tests__/LiveActivity.test.tsx:17-50` - Mock data structure showing both `createdAt` and `updatedAt` fields

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Type check passes
  cd src/client && bun run tsc --noEmit
  # Assert: Exit code 0, no errors
  
  # Existing tests still pass
  cd src/client && bun run test -- --grep "LiveActivity"
  # Assert: All tests pass
  ```

  **Code Change Verification:**
  ```bash
  # Verify the change was made correctly
  grep -A5 "sortNodes" src/client/src/components/LiveActivity.tsx | grep "updatedAt"
  # Assert: Output contains "updatedAt"
  
  grep "isRoot" src/client/src/components/LiveActivity.tsx | grep -v "//"
  # Assert: No uncommented references to isRoot in sort logic
  ```

  **Commit**: YES
  - Message: `fix(client): sort subagents by most recent activity`
  - Files: `src/client/src/components/LiveActivity.tsx`
  - Pre-commit: `cd src/client && bun run test -- --grep "LiveActivity"`

---

- [ ] 2. Add `detectAgentPhases()` helper function

  **What to do**:
  - Open `src/server/index.ts`
  - Add new interface `AgentPhase` near other interfaces (around line 17)
  - Add new function `detectAgentPhases(messages: MessageMeta[]): AgentPhase[]`
  - Function should:
    1. Filter to assistant messages with agent field
    2. Sort by createdAt ascending
    3. Group consecutive messages by agent
    4. Return array of phases with { agent, startTime, endTime, tokens, messageCount }

  **Must NOT do**:
  - Modify existing functions yet (that's Task 3)
  - Change any imports or exports
  - Add external dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single function addition with clear specification
  - **Skills**: None needed
    - Standard TypeScript, follows existing patterns in file

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3, Task 5
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/server/index.ts:37-55` - `buildAgentHierarchy()` shows similar message iteration pattern
  - `src/server/index.ts:267-315` - `getSessionHierarchy()` shows how messages are filtered and sorted

  **Type References**:
  - `src/shared/types/index.ts:26-37` - `MessageMeta` type with `agent`, `createdAt`, `tokens` fields

  **Implementation Specification**:
  ```typescript
  interface AgentPhase {
    agent: string;
    startTime: Date;
    endTime: Date;
    tokens: number;
    messageCount: number;
  }

  function detectAgentPhases(messages: MessageMeta[]): AgentPhase[] {
    const sorted = messages
      .filter(m => m.role === 'assistant' && m.agent)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    if (sorted.length === 0) return [];
    
    const phases: AgentPhase[] = [];
    let currentPhase: AgentPhase | null = null;
    
    for (const msg of sorted) {
      if (!currentPhase || currentPhase.agent !== msg.agent) {
        if (currentPhase) phases.push(currentPhase);
        currentPhase = {
          agent: msg.agent!,
          startTime: msg.createdAt,
          endTime: msg.createdAt,
          tokens: msg.tokens || 0,
          messageCount: 1,
        };
      } else {
        currentPhase.endTime = msg.createdAt;
        currentPhase.tokens += msg.tokens || 0;
        currentPhase.messageCount++;
      }
    }
    if (currentPhase) phases.push(currentPhase);
    
    return phases;
  }
  ```

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Type check passes
  bun run tsc -b
  # Assert: Exit code 0, no errors
  
  # Function exists and is callable
  grep -n "function detectAgentPhases" src/server/index.ts
  # Assert: Line number returned, function exists
  
  # Interface exists
  grep -n "interface AgentPhase" src/server/index.ts
  # Assert: Line number returned, interface exists
  ```

  **Commit**: NO (groups with Task 3)

---

- [ ] 3. Modify `getSessionHierarchy()` to create virtual roots for agent phases

  **What to do**:
  - Open `src/server/index.ts`
  - Modify `getSessionHierarchy()` function (lines 267-315)
  - After getting root session messages, call `detectAgentPhases()`
  - If 1 phase: use existing behavior (single root)
  - If 2+ phases: create virtual root for each phase
  - Virtual root ID format: `{sessionId}-phase-{index}-{agent}`
  - Attribute child sessions to phases based on `child.createdAt` timing
  - Set child's `parentID` in response to virtual root ID

  **Must NOT do**:
  - Break backward compatibility for single-agent sessions
  - Modify child sessions in storage (only in API response)
  - Change PollResponse interface structure
  - Add new API endpoints

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex logic modification requiring careful handling of edge cases
  - **Skills**: None needed
    - TypeScript, follows existing patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential after Task 2)
  - **Blocks**: Task 5, Task 6
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/server/index.ts:267-315` - Current `getSessionHierarchy()` implementation to modify
  - `src/server/index.ts:283-286` - How first assistant message is currently found
  - `src/server/index.ts:294-306` - How ActivitySession objects are constructed

  **Type References**:
  - `src/shared/types/index.ts:43-55` - `ActivitySession` type (no changes needed)
  - `src/server/utils/sessionStatus.ts` - `getStatusFromTimestamp()` for virtual root status

  **API References**:
  - `src/server/index.ts:317-324` - `PollResponse` interface (must remain compatible)

  **Key Logic**:
  ```typescript
  // Inside getSessionHierarchy(), after getting root session:
  const rootMessages = await listMessages(rootSessionId);
  const phases = detectAgentPhases(rootMessages);
  
  if (phases.length <= 1) {
    // Existing behavior - single root
    // ... keep current code path ...
  } else {
    // Multiple phases - create virtual roots
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const nextPhaseStart = phases[i + 1]?.startTime || new Date(8640000000000000);
      
      // Create virtual root
      const virtualId = `${rootSessionId}-phase-${i}-${phase.agent}`;
      result.push({
        id: virtualId,
        title: rootSession.title,
        agent: phase.agent,
        parentID: undefined,  // This makes it a root
        tokens: phase.tokens,
        status: getStatusFromTimestamp(phase.endTime),
        createdAt: phase.startTime,
        updatedAt: phase.endTime,
      });
      
      // Attribute children to this phase
      const phaseChildren = childSessions.filter(child => 
        child.createdAt >= phase.startTime && 
        child.createdAt < nextPhaseStart
      );
      
      for (const child of phaseChildren) {
        // ... process child with parentID = virtualId ...
      }
    }
  }
  ```

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Type check passes
  bun run tsc -b
  # Assert: Exit code 0, no errors
  
  # Server starts without errors
  timeout 5 bun run src/server/index.ts --no-browser || true
  # Assert: "OCWatch API server running" appears in output
  
  # Existing poll tests pass
  bun test src/server/__tests__/poll.test.ts
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(server): detect agent transitions and create virtual root nodes`
  - Files: `src/server/index.ts`
  - Pre-commit: `bun test src/server/__tests__/poll.test.ts`

---

- [ ] 4. Update LiveActivity tests for new sorting behavior

  **What to do**:
  - Open `src/client/src/components/__tests__/LiveActivity.test.tsx`
  - Add test case: "sorts children by updatedAt descending"
  - Modify mock data to have distinct `updatedAt` values
  - Verify that most recently updated child appears first

  **Must NOT do**:
  - Remove or break existing tests
  - Change the mock data structure in ways that break other tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple test addition following existing patterns
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:

  **Test References**:
  - `src/client/src/components/__tests__/LiveActivity.test.tsx` - Existing test patterns
  - `src/client/src/components/__tests__/LiveActivity.test.tsx:17-50` - Mock data structure

  **Pattern References**:
  - `src/client/src/components/__tests__/LiveActivity.test.tsx:96-101` - Test checking tree structure

  **New Test Specification**:
  ```typescript
  it('sorts children by most recent activity (updatedAt descending)', () => {
    const sessionsWithVaryingActivity: ActivitySession[] = [
      {
        id: 'root',
        title: 'Root',
        agent: 'prometheus',
        createdAt: new Date('2024-01-15T10:00:00'),
        updatedAt: new Date('2024-01-15T10:30:00'),
      },
      {
        id: 'child-old',
        title: 'Old child',
        agent: 'explore',
        parentID: 'root',
        createdAt: new Date('2024-01-15T10:05:00'),
        updatedAt: new Date('2024-01-15T10:10:00'),  // Updated earlier
      },
      {
        id: 'child-recent',
        title: 'Recent child',
        agent: 'sisyphus',
        parentID: 'root',
        createdAt: new Date('2024-01-15T10:03:00'),  // Created earlier
        updatedAt: new Date('2024-01-15T10:25:00'),  // But updated more recently
      },
    ];
    
    render(<LiveActivity sessions={sessionsWithVaryingActivity} loading={false} />);
    
    const agentBadges = screen.getAllByText(/sisyphus|explore/);
    // sisyphus should appear before explore (more recently updated)
    expect(agentBadges[0]).toHaveTextContent('sisyphus');
    expect(agentBadges[1]).toHaveTextContent('explore');
  });
  ```

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # All LiveActivity tests pass including new test
  cd src/client && bun run test -- --grep "LiveActivity"
  # Assert: All tests pass, including "sorts children by most recent activity"
  ```

  **Commit**: YES
  - Message: `test(client): add test for updatedAt descending sort order`
  - Files: `src/client/src/components/__tests__/LiveActivity.test.tsx`
  - Pre-commit: `cd src/client && bun run test -- --grep "LiveActivity"`

---

- [ ] 5. Add server tests for agent phase detection

  **What to do**:
  - Create or update test file for agent phase detection
  - Test `detectAgentPhases()` with:
    - Empty messages array
    - Single agent (one phase)
    - Two agents (two phases)
    - Agent returning after being replaced (three phases)
    - Messages without agent field (should be skipped)
  - Test that `getSessionHierarchy()` creates virtual roots correctly

  **Must NOT do**:
  - Mock external storage (tests run against real empty/mock data)
  - Break existing poll tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Test file additions following existing patterns
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3, 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 2, Task 3

  **References**:

  **Test References**:
  - `src/server/__tests__/poll.test.ts` - Existing server test patterns
  - `src/server/index.test.ts` - Unit test patterns for index.ts

  **Pattern References**:
  - `src/server/__tests__/poll.test.ts:5-21` - Test structure and assertions

  **Test Specification**:
  ```typescript
  describe('detectAgentPhases', () => {
    it('returns empty array for no messages', () => {
      const result = detectAgentPhases([]);
      expect(result).toEqual([]);
    });
    
    it('returns single phase for single agent', () => {
      const messages: MessageMeta[] = [
        { id: '1', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:00:00') },
        { id: '2', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:05:00') },
      ];
      const result = detectAgentPhases(messages);
      expect(result).toHaveLength(1);
      expect(result[0].agent).toBe('prometheus');
    });
    
    it('returns two phases for agent transition', () => {
      const messages: MessageMeta[] = [
        { id: '1', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:00:00') },
        { id: '2', sessionID: 's1', role: 'assistant', agent: 'atlas', createdAt: new Date('2024-01-01T10:30:00') },
      ];
      const result = detectAgentPhases(messages);
      expect(result).toHaveLength(2);
      expect(result[0].agent).toBe('prometheus');
      expect(result[1].agent).toBe('atlas');
    });
    
    it('creates new phase when agent returns', () => {
      const messages: MessageMeta[] = [
        { id: '1', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:00:00') },
        { id: '2', sessionID: 's1', role: 'assistant', agent: 'atlas', createdAt: new Date('2024-01-01T10:30:00') },
        { id: '3', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T11:00:00') },
      ];
      const result = detectAgentPhases(messages);
      expect(result).toHaveLength(3);
    });
    
    it('skips messages without agent field', () => {
      const messages: MessageMeta[] = [
        { id: '1', sessionID: 's1', role: 'user', createdAt: new Date('2024-01-01T10:00:00') },
        { id: '2', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:05:00') },
      ];
      const result = detectAgentPhases(messages);
      expect(result).toHaveLength(1);
    });
  });
  ```

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # All server tests pass
  bun test
  # Assert: All tests pass, including new detectAgentPhases tests
  ```

  **Commit**: YES
  - Message: `test(server): add tests for agent phase detection`
  - Files: `src/server/__tests__/agentPhases.test.ts` or `src/server/index.test.ts`
  - Pre-commit: `bun test`

---

- [ ] 6. Manual verification and final checks

  **What to do**:
  - Start development server
  - Test with a real multi-agent session (or create mock data)
  - Verify sorting behavior visually
  - Verify agent phases appear as separate roots
  - Run full test suite
  - Run type checks

  **Must NOT do**:
  - Skip any verification step
  - Commit without all tests passing

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification steps, no complex implementation
  - **Skills**: `['playwright']` if browser automation needed, otherwise none

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final, sequential)
  - **Blocks**: None (final task)
  - **Blocked By**: All previous tasks

  **References**:

  **Documentation References**:
  - `AGENTS.md:COMMANDS` - Dev server startup commands
  - `README.md` - Project overview and usage

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Full type check
  bun run tsc -b
  # Assert: Exit code 0
  
  # All server tests pass
  bun test
  # Assert: All tests pass
  
  # All client tests pass
  cd src/client && bun run test
  # Assert: All tests pass
  ```

  **Manual Verification (via playwright skill if available):**
  ```
  1. Start dev server: bun run dev
  2. Navigate to: http://localhost:5173
  3. Select a session from sidebar
  4. Observe LiveActivity panel:
     - Children should be sorted by most recent activity
     - If agent transitions exist, multiple root nodes should appear
  5. Screenshot: .sisyphus/evidence/task-6-final-verification.png
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(client): sort subagents by most recent activity` | LiveActivity.tsx | client tests |
| 3 | `feat(server): detect agent transitions and create virtual root nodes` | index.ts | server tests |
| 4 | `test(client): add test for updatedAt descending sort order` | LiveActivity.test.tsx | client tests |
| 5 | `test(server): add tests for agent phase detection` | agentPhases.test.ts | server tests |

---

## Success Criteria

### Verification Commands
```bash
# Type check
bun run tsc -b
# Expected: Exit 0, no errors

# Server tests
bun test
# Expected: All tests pass

# Client tests  
cd src/client && bun run test
# Expected: All tests pass

# Dev server starts
bun run dev
# Expected: Server on :50234, client on :5173
```

### Final Checklist
- [ ] Children sorted by `updatedAt` descending (most recent first)
- [ ] Agent transitions create separate root nodes  
- [ ] Single-agent sessions work exactly as before (backward compatible)
- [ ] All existing tests pass
- [ ] New tests cover sorting and phase detection
- [ ] Type checks pass with no errors
- [ ] Manual verification confirms expected behavior
