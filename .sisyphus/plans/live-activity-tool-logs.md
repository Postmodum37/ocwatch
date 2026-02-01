# Live Activity Tool Logs Enhancement

## TL;DR

> **Quick Summary**: Add tool call visibility to the Live Activity view, showing the last 5 tool calls per agent (expandable to all) with name, args summary, and status badge. Click tool row to see full arguments.
> 
> **Deliverables**:
> - Extended `/api/poll` response with `toolCalls` per ActivitySession
> - Modified LiveActivity component with collapsible tool call list
> - ToolCallRow component with expandable arguments
> - TDD tests for all new functionality
> 
> **Estimated Effort**: Medium (2-3 days)
> **Parallel Execution**: YES - 2 waves (backend first, then frontend)
> **Critical Path**: Task 1 (types) -> Task 2 (server) -> Task 4 (frontend) -> Task 5 (integration)

---

## Context

### Original Request
User wants to see tool usage logs in the Live Activity view. Currently only shows agent badges with status and "Thinking..." text. Wants to see actual tool calls like Read, Grep, Bash with their arguments and status.

### Interview Summary
**Key Discussions**:
- **Interaction**: Always show last 5 tool calls, click agent row to expand to all, click again to collapse
- **Detail level**: Tool name + brief args + status indicator
- **Visual layout**: Indented list below agent (same style as child agents)
- **Args display**: Expandable accordion - click tool call row to see full arguments
- **Live updates**: New tool calls stream in via existing 2s polling
- **Test strategy**: TDD style (tests first)

**Research Findings**:
- ToolCall interface already exists but isn't fully utilized
- PartMeta has rich tool data: `tool`, `state`, `input` (filePath, command, etc.)
- Tool calls are NOT directly linked to agents - must join via `messageID -> message.agent`
- partParser.ts already has `getPartsForSession()`, `formatCurrentAction()`, `isPendingToolCall()`
- LiveActivity uses recursive SessionRow component pattern

### Metis Review
**Identified Gaps** (addressed):
- **Agent-to-tool mapping**: Tool calls must be mapped via messageID -> message.agent. Solution: Create `getToolCallsForSession()` that enriches parts with agent info.
- **Which 5 tools?**: Clarified as per ActivitySession (tree node), not across hierarchy.
- **Memory cap**: Added 50 tool calls max per session in API response.
- **Edge cases**: Empty input shows tool name only, long paths truncated, nested objects as JSON.

---

## Work Objectives

### Core Objective
Add tool call visibility to Live Activity view, enabling users to see what tools each agent is using and has used, with expandable details.

### Concrete Deliverables
1. `ToolCallSummary` type in `src/shared/types/index.ts`
2. `getToolCallsForSession()` function in `src/server/storage/partParser.ts`
3. Extended `ActivitySession` type with `toolCalls: ToolCallSummary[]`
4. Modified `/api/poll` endpoint to include tool calls
5. `ToolCallRow` component in `src/client/src/components/`
6. Modified `SessionRow` in LiveActivity.tsx with collapsible tool calls
7. Unit tests for all new functionality

### Definition of Done
- [ ] `bun test` passes (server tests)
- [ ] `cd src/client && bun run test` passes (client tests)
- [ ] API returns tool calls: `curl http://localhost:50234/api/poll | jq '.activitySessions[0].toolCalls'` returns array
- [ ] Visual: Agent row click expands/collapses tool calls
- [ ] Visual: Tool call row click expands/collapses arguments

### Must Have
- Tool calls shown per ActivitySession (per tree node)
- Last 5 by default, expandable to all
- Status badge (pending/complete/error)
- Tool name + brief args summary
- Expandable full arguments on click
- TDD tests for new functions/components

### Must NOT Have (Guardrails)
- DO NOT modify existing `ToolCalls.tsx` component (build new into LiveActivity)
- DO NOT display tool output/results (just inputs and status)
- DO NOT add filtering/search functionality
- DO NOT add new API endpoints (extend `/api/poll` only)
- DO NOT add tool duration/timing display
- DO NOT color-code by tool type (defer to follow-up)
- Max 50 tool calls per session in API response (memory cap)
- DO NOT add virtualization (v1 simplicity)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Bun test for server, Vitest for client)
- **User wants tests**: YES (TDD)
- **Framework**: Bun test (server), Vitest (client)

### TDD Workflow

Each TODO follows RED-GREEN-REFACTOR:

**Task Structure:**
1. **RED**: Write failing test first
   - Test file created
   - Test command shows FAIL
2. **GREEN**: Implement minimum code to pass
   - Test command shows PASS
3. **REFACTOR**: Clean up while keeping green

### Test Commands
```bash
# Server tests
bun test src/server/storage/__tests__/partParser.test.ts

# Client tests  
cd src/client && bun run test src/components/__tests__/ToolCallRow.test.tsx
cd src/client && bun run test src/components/__tests__/LiveActivity.test.tsx
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Define ToolCallSummary type (no dependencies)
└── Task 3: Write client component tests (no dependencies - can write tests before implementation)

Wave 2 (After Task 1):
├── Task 2: Server - getToolCallsForSession + poll extension (depends: 1)
└── Task 4: Client - ToolCallRow + LiveActivity modification (depends: 1, 3)

Wave 3 (After Wave 2):
└── Task 5: Integration testing (depends: 2, 4)

Critical Path: Task 1 -> Task 2 -> Task 5
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 4 | 3 |
| 2 | 1 | 5 | 4 (after 1 done) |
| 3 | None | 4 | 1 |
| 4 | 1, 3 | 5 | 2 |
| 5 | 2, 4 | None | None (final) |

---

## TODOs

- [ ] 1. Define ToolCallSummary type and extend ActivitySession

  **What to do**:
  - Create `ToolCallSummary` interface in `src/shared/types/index.ts`
  - Fields: `id`, `name`, `state` (pending/complete/error), `summary` (brief args), `input` (full args object), `timestamp`, `agentName`
  - Extend `ActivitySession` interface to include `toolCalls?: ToolCallSummary[]`
  - Export new type

  **Must NOT do**:
  - Don't add tool output/result fields
  - Don't add duration fields

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple type definition, single file change
  - **Skills**: []
    - No special skills needed for type definitions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: Tasks 2, 4
  - **Blocked By**: None (can start immediately)

  **References**:
  
  **Pattern References**:
  - `src/shared/types/index.ts:ToolCall` (lines 45-51) - Existing ToolCall interface to reference
  - `src/shared/types/index.ts:ActivitySession` (lines 90-103) - Interface to extend
  - `src/shared/types/index.ts:PartMeta` (lines 53-65) - Source fields for ToolCallSummary
  
  **API/Type References**:
  - `src/shared/types/index.ts:ToolInput` - Existing type for tool arguments

  **Acceptance Criteria**:

  **TDD (RED phase):**
  - [ ] TypeScript compiler accepts new types: `bun run tsc -b` -> no errors related to ToolCallSummary

  **Automated Verification:**
  ```bash
  # Agent runs:
  bun -e "import { ToolCallSummary, ActivitySession } from './src/shared/types'; console.log('Types imported successfully')"
  # Assert: Output is "Types imported successfully"
  # Assert: Exit code 0
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from type check command

  **Commit**: YES
  - Message: `feat(types): add ToolCallSummary type and extend ActivitySession`
  - Files: `src/shared/types/index.ts`
  - Pre-commit: `bun run tsc -b`

---

- [ ] 2. Server: Implement getToolCallsForSession and extend poll endpoint

  **What to do**:
  - **Test first (RED)**: Write test for `getToolCallsForSession()` in `src/server/storage/__tests__/partParser.test.ts`
  - Create `getToolCallsForSession(sessionID: string, messageAgent: Map<string, string>)` function in `partParser.ts`
  - Function should: load parts for session, filter for tool type, map to ToolCallSummary with agent from messageAgent map
  - Limit to 50 most recent tool calls (sorted by timestamp desc)
  - **Test first (RED)**: Write test for poll endpoint returning toolCalls
  - Modify where activitySessions are constructed in `src/server/index.ts` (via `getSessionHierarchy()`) to populate toolCalls
  - Build messageAgent map by iterating session messages
  - **GREEN**: Implement until tests pass
  - **REFACTOR**: Clean up

  **Must NOT do**:
  - Don't create new API endpoint (extend existing)
  - Don't expose tool output/results
  - Don't remove the 50 tool call cap

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Server logic with data transformation, needs careful implementation
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/server/storage/partParser.ts:getPartsForSession()` (lines 95-120) - Existing function to load parts
  - `src/server/storage/partParser.ts:formatCurrentAction()` (lines 140-180) - Pattern for creating summary text
  - `src/server/storage/partParser.ts:isPendingToolCall()` (lines 125-135) - Status determination logic
  - `src/server/index.ts:getSessionHierarchy()` - Function where activitySessions are constructed; modify to include toolCalls

  **API/Type References**:
  - `src/shared/types/index.ts:PartMeta` - Source data structure
  - `src/shared/types/index.ts:ToolCallSummary` - Target data structure (from Task 1)

  **Test References**:
  - `src/server/storage/__tests__/parsers.test.ts` - Existing parser tests pattern
  - `src/server/__tests__/poll.test.ts` - Poll endpoint test patterns

  **Acceptance Criteria**:

  **TDD (RED-GREEN-REFACTOR):**
  - [ ] Test file exists: `src/server/storage/__tests__/partParser.test.ts`
  - [ ] Test: `getToolCallsForSession returns array of ToolCallSummary`
  - [ ] Test: `getToolCallsForSession respects 50 item limit`
  - [ ] Test: `getToolCallsForSession includes agent name from message map`
  - [ ] `bun test src/server/storage/__tests__/partParser.test.ts` -> PASS

  **Automated Verification (API):**
  ```bash
  # Start server first (in background or separate terminal)
  # Agent runs:
  curl -s http://localhost:50234/api/poll | jq '.activitySessions[0].toolCalls | type'
  # Assert: Returns "array" (not "null")
  
  curl -s http://localhost:50234/api/poll | jq '.activitySessions[0].toolCalls[0] | keys'
  # Assert: Contains ["id", "name", "state", "summary", "input", "timestamp", "agentName"]
  
  curl -s http://localhost:50234/api/poll | jq '.activitySessions[0].toolCalls | length <= 50'
  # Assert: Returns true
  ```

  **Evidence to Capture:**
  - [ ] Test output showing all tests pass
  - [ ] curl output showing toolCalls in response

  **Commit**: YES
  - Message: `feat(server): add tool call aggregation to poll endpoint`
  - Files: `src/server/storage/partParser.ts`, `src/server/index.ts`, `src/server/storage/__tests__/partParser.test.ts`
  - Pre-commit: `bun test`

---

- [ ] 3. Client: Write tests for ToolCallRow and LiveActivity tool integration

  **What to do**:
  - **RED phase only** - write failing tests before implementation
  - Create `src/client/src/components/__tests__/ToolCallRow.test.tsx`
  - Test cases for ToolCallRow:
    - Renders tool name and summary
    - Shows correct status badge (pending/complete/error)
    - Click expands to show full arguments
    - Click again collapses arguments
  - Add tests to existing `LiveActivity.test.tsx`:
    - Agent row with toolCalls shows tool call list
    - Default shows max 5 tool calls
    - Click agent row expands to show all
    - Click again collapses to last 5

  **Must NOT do**:
  - Don't implement components yet (tests only)
  - Don't modify existing passing tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Writing test stubs that will initially fail
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Test References**:
  - `src/client/src/components/__tests__/LiveActivity.test.tsx` - Existing LiveActivity tests pattern
  - `src/client/src/components/__tests__/SessionList.test.tsx` - Component test patterns with mocking

  **Pattern References**:
  - `src/client/src/components/LiveActivity.tsx:SessionRow` - Component structure to test against

  **Documentation References**:
  - Vitest docs: https://vitest.dev/api/ - Testing API reference

  **Acceptance Criteria**:

  **TDD (RED phase):**
  - [ ] Test file exists: `src/client/src/components/__tests__/ToolCallRow.test.tsx`
  - [ ] Tests written but failing (components don't exist yet)
  - [ ] `cd src/client && bun run test` -> Shows test failures (expected)

  **Evidence to Capture:**
  - [ ] Test file contents
  - [ ] Test output showing expected failures

  **Commit**: YES
  - Message: `test(client): add failing tests for ToolCallRow and tool integration`
  - Files: `src/client/src/components/__tests__/ToolCallRow.test.tsx`, `src/client/src/components/__tests__/LiveActivity.test.tsx`
  - Pre-commit: None (tests expected to fail)

---

- [ ] 4. Client: Implement ToolCallRow and modify LiveActivity

  **What to do**:
  - **GREEN phase**: Make tests from Task 3 pass
  - Create `src/client/src/components/ToolCallRow.tsx`:
    - Props: `toolCall: ToolCallSummary`, `depth: number`
    - Render: indented row with tool name, summary, status badge
    - State: `expanded: boolean` for arguments accordion
    - Click handler: toggle expanded state
    - When expanded: show full `input` object as formatted JSON or key-value pairs
  - Modify `SessionRow` in `src/client/src/components/LiveActivity.tsx`:
    - Add state: `toolsExpanded: boolean`, default false
    - Add state: `showAllTools: boolean`, default false
    - Click handler on agent row: toggle toolsExpanded
    - When toolsExpanded: render tool calls
    - If !showAllTools: slice to last 5, show "show N more" link
    - Click "show more": set showAllTools=true
  - Style tool call rows to match existing tree aesthetic (indentation, colors)
  - **REFACTOR**: Clean up code while keeping tests green

  **Must NOT do**:
  - Don't modify ToolCalls.tsx component
  - Don't add tool duration display
  - Don't add filtering/search
  - Don't color-code by tool type

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component implementation with styling
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Needed for component styling and interaction patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 1, 3)
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1 (types), Task 3 (tests)

  **References**:

  **Pattern References**:
  - `src/client/src/components/LiveActivity.tsx:SessionRow` (lines 94-169) - Component to modify, follow same patterns
  - `src/client/src/utils/agentColors.ts` - Color utilities for badges
  - `src/client/src/components/LiveActivity.tsx:StatusIndicator` (lines 50-92) - Badge rendering pattern

  **API/Type References**:
  - `src/shared/types/index.ts:ToolCallSummary` - Props type for ToolCallRow
  - `src/shared/types/index.ts:ActivitySession` - Extended with toolCalls

  **Test References**:
  - `src/client/src/components/__tests__/ToolCallRow.test.tsx` - Tests to make pass (from Task 3)

  **External References**:
  - Tailwind CSS dark theme colors from AGENTS.md: Background #0d1117, Surface #161b22, Accent #58a6ff, Text #c9d1d9

  **Acceptance Criteria**:

  **TDD (GREEN phase):**
  - [ ] `cd src/client && bun run test src/components/__tests__/ToolCallRow.test.tsx` -> PASS
  - [ ] `cd src/client && bun run test src/components/__tests__/LiveActivity.test.tsx` -> PASS

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173
  2. Wait for: selector "[data-testid='session-row']" to be visible
  3. Click: first session row with toolCalls
  4. Wait for: selector "[data-testid='tool-call-row']" to be visible
  5. Assert: at most 5 tool call rows visible
  6. If "show more" link exists: click it
  7. Assert: more than 5 tool call rows visible
  8. Click: first tool call row
  9. Wait for: selector "[data-testid='tool-args-expanded']" to be visible
  10. Screenshot: .sisyphus/evidence/task-4-tool-calls.png
  ```

  **Evidence to Capture:**
  - [ ] Test output showing all tests pass
  - [ ] Screenshot of tool calls expanded

  **Commit**: YES
  - Message: `feat(client): add tool call visibility to LiveActivity`
  - Files: `src/client/src/components/ToolCallRow.tsx`, `src/client/src/components/LiveActivity.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [ ] 5. Integration testing and polish

  **What to do**:
  - Run full test suite (server + client)
  - Manual verification with dev server running
  - Test edge cases:
    - Agent with 0 tool calls (no tool section shown)
    - Agent with 1 tool call (shows 1, no "show more")
    - Agent with exactly 5 tool calls (shows 5, no "show more")
    - Agent with 6+ tool calls (shows 5 + "show N more")
    - Tool with empty input (shows tool name only)
    - Tool with very long filePath (truncated in summary)
  - Fix any visual/styling issues
  - Ensure 2s polling shows new tool calls streaming in

  **Must NOT do**:
  - Don't add new features
  - Don't refactor unrelated code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Testing and minor fixes
  - **Skills**: [`playwright`]
    - `playwright`: Needed for browser-based visual verification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocks**: None
  - **Blocked By**: Tasks 2, 4

  **References**:

  **Test References**:
  - All test files created in previous tasks

  **Pattern References**:
  - `src/client/src/components/LiveActivity.tsx` - Final implementation

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # All server tests pass
  bun test
  # Assert: Exit code 0, all tests pass
  
  # All client tests pass
  cd src/client && bun run test
  # Assert: Exit code 0, all tests pass
  ```

  **Automated Verification (Playwright - edge cases):**
  ```
  # Agent executes via playwright browser automation:
  
  # Test 1: Agent with 0 tool calls
  1. Find session row where toolCalls is empty array
  2. Click session row
  3. Assert: No tool call rows appear
  
  # Test 2: Tool with empty input
  1. Find tool call with empty/null input
  2. Assert: Shows tool name without args summary
  
  # Test 3: Live update streaming
  1. Note current tool call count
  2. Wait 3 seconds
  3. If agent is working, assert: new tool calls may have appeared
  
  4. Screenshot: .sisyphus/evidence/task-5-integration.png
  ```

  **Evidence to Capture:**
  - [ ] Full test suite output
  - [ ] Screenshot of various edge cases

  **Commit**: YES
  - Message: `test(integration): verify tool call feature end-to-end`
  - Files: Any polish/fixes discovered
  - Pre-commit: `bun test && cd src/client && bun run test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(types): add ToolCallSummary type and extend ActivitySession` | src/shared/types/index.ts | `bun run tsc -b` |
| 2 | `feat(server): add tool call aggregation to poll endpoint` | partParser.ts, index.ts, tests | `bun test` |
| 3 | `test(client): add failing tests for ToolCallRow and tool integration` | test files | None (expected fail) |
| 4 | `feat(client): add tool call visibility to LiveActivity` | ToolCallRow.tsx, LiveActivity.tsx | `cd src/client && bun run test` |
| 5 | `test(integration): verify tool call feature end-to-end` | Any fixes | Full test suite |

---

## Success Criteria

### Verification Commands
```bash
# Server tests
bun test
# Expected: All tests pass

# Client tests
cd src/client && bun run test
# Expected: All tests pass

# API check
curl -s http://localhost:50234/api/poll | jq '.activitySessions[0].toolCalls | length'
# Expected: Number (0 or more)

# TypeScript check
bun run tsc -b
# Expected: No errors
```

### Final Checklist
- [ ] All "Must Have" present:
  - [ ] Tool calls shown per ActivitySession
  - [ ] Last 5 by default, expandable to all
  - [ ] Status badge (pending/complete/error)
  - [ ] Tool name + brief args summary
  - [ ] Expandable full arguments on click
  - [ ] TDD tests for new functions/components
- [ ] All "Must NOT Have" absent:
  - [ ] No modifications to ToolCalls.tsx
  - [ ] No tool output/results displayed
  - [ ] No filtering/search added
  - [ ] No new API endpoints created
  - [ ] No tool duration display
  - [ ] Max 50 tool calls enforced
- [ ] All tests pass
