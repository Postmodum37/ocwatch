# Live Activity View Rework

## TL;DR

> **Quick Summary**: Replace the AgentTree component (which shows session hierarchy) with a new LiveActivity component that displays real-time agent calls, tool invocations, and delegation chains within the selected session.
> 
> **Deliverables**:
> - New `LiveActivity.tsx` component with indented timeline visualization
> - Modified `/api/poll` endpoint to include session messages
> - Updated AppContext with messages state
> - Wired ToolCalls integration (either inline or panel)
> - Color-coded agents with token usage display
> 
> **Estimated Effort**: Medium (4-6 tasks, ~4-6 hours)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (types) → Task 2 (API) → Task 4 (component) → Task 6 (integration)

---

## Context

### Original Request
The main activity dashboard shows SESSION NODES instead of TASKS, AGENT CALLS WITH ASSOCIATED MODELS in LIVE VIEW. Need to rework the live activity view on the right side to actually represent a live view of the session.

### Interview Summary
**Key Discussions**:
- **Layout**: Replace AgentTree entirely with LiveActivity (confirmed)
- **Visualization**: Indented timeline with agent nesting (confirmed)
- **Data source**: Selected session from sidebar; auto-select most recent if none
- **Limits**: 100 messages, lazy load tool calls for visible messages

**Research Findings**:
- `/api/sessions/:id/messages` endpoint exists but isn't used in UI
- `buildAgentHierarchy()` function exists on server but unused
- `getAgentColor()` function in AgentTree.tsx can be extracted to shared utils
- MessageMeta has all needed fields: `agent`, `modelID`, `parentID`, `tokens`
- PartMeta has `tool`, `state` fields for tool call display

### Self-Review (Gap Analysis)

**Identified Gaps (addressed)**:
- **Loading states**: Will need skeleton for LiveActivity during fetch
- **Empty state**: Need design for when no messages exist
- **Error handling**: What if message fetch fails mid-session?
- **Auto-scroll behavior**: Need ref to scroll container

---

## Work Objectives

### Core Objective
Replace the session hierarchy visualization (AgentTree) with a live activity timeline showing agent calls, tool invocations, and delegation chains for the selected session.

### Concrete Deliverables
- `src/client/src/components/LiveActivity.tsx` - New timeline component
- `src/client/src/utils/agentColors.ts` - Extracted color utility
- Modified `src/server/index.ts` - `/api/poll` includes messages
- Modified `src/client/src/store/AppContext.tsx` - Messages state
- Modified `src/client/src/App.tsx` - LiveActivity replaces AgentTree
- `src/client/src/components/__tests__/LiveActivity.test.tsx` - Component tests

### Definition of Done
- [ ] LiveActivity shows agent calls with model badges (color-coded)
- [ ] Tool calls appear nested under their parent agent message
- [ ] Timeline auto-scrolls to latest entry on new data
- [ ] Token usage displayed when available
- [ ] Tool calls are collapsible per agent
- [ ] Empty state shown when no messages
- [ ] Loading skeleton during initial fetch
- [ ] All existing tests pass
- [ ] New LiveActivity tests pass

### Must Have
- Agent color coding (sisyphus=blue, prometheus=purple, explore/librarian=green, oracle=amber, build=cyan)
- Indented timeline showing delegation hierarchy via parentID
- Real-time updates (2s polling maintained)
- Timestamps with relative time display
- Status indicators for tool calls (pending/complete/error)

### Must NOT Have (Guardrails)
- WebSocket implementation (HTTP polling only)
- Session filtering/search UI
- Token/cost estimation calculations
- Historical analytics or charts
- React Flow for this component (using simple DOM)
- Bulk-loading all part files (lazy load only)
- Changes to SessionList sidebar (left panel stays as-is)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: YES (project has extensive test coverage)
- **Framework**: 
  - Server: `bun test`
  - Client: `vitest` with `@testing-library/react`

### Automated Verification

Each TODO includes verification commands that can be run by the executor:

**For Component changes**:
```bash
cd src/client && bun run test --run
```

**For Server changes**:
```bash
bun test
```

**For Integration**:
```bash
bun run dev:server &
# Wait for server
curl -s http://localhost:50234/api/poll | jq '.messages'
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Extract agent color utility (no dependencies)
└── Task 2: Add messages to /api/poll endpoint (no dependencies)

Wave 2 (After Wave 1):
├── Task 3: Update AppContext with messages state (depends: 2)
└── Task 4: Create LiveActivity component (depends: 1)

Wave 3 (After Wave 2):
├── Task 5: Wire LiveActivity to App.tsx (depends: 3, 4)
└── Task 6: Add LiveActivity tests (depends: 4, 5)

Critical Path: Task 1 → Task 4 → Task 5 → Task 6
Parallel Speedup: ~40% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 4 | 2 |
| 2 | None | 3 | 1 |
| 3 | 2 | 5 | 4 |
| 4 | 1 | 5, 6 | 3 |
| 5 | 3, 4 | 6 | None |
| 6 | 4, 5 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | dispatch parallel with category="quick" |
| 2 | 3, 4 | dispatch parallel, task 4 is larger |
| 3 | 5, 6 | sequential - integration then tests |

---

## TODOs

- [ ] 1. Extract Agent Color Utility

  **What to do**:
  - Create `src/client/src/utils/agentColors.ts`
  - Extract `getAgentColor()` function from `AgentTree.tsx`
  - Export as named export for reuse
  - Keep color mapping consistent: sisyphus=blue, prometheus=purple, explore/librarian=green, oracle=amber, build=cyan, default=gray

  **Must NOT do**:
  - Change the existing color values
  - Add new dependencies
  - Modify AgentTree.tsx in this task (will be replaced later)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple extraction task, < 30 lines of code
  - **Skills**: None needed
    - This is a pure code move, no special domain knowledge required

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/client/src/components/AgentTree.tsx:60-68` - Existing getAgentColor function to extract

  **Target Location**:
  - `src/client/src/utils/agentColors.ts` - New file

  **Acceptance Criteria**:

  ```bash
  # Verify file exists and exports function
  cat src/client/src/utils/agentColors.ts | grep "export function getAgentColor"
  # Should output the function signature
  ```

  ```bash
  # Verify TypeScript compiles
  cd src/client && bun run tsc --noEmit
  # Should exit 0 with no errors
  ```

  **Evidence to Capture:**
  - [ ] Terminal output from tsc command showing no errors

  **Commit**: YES
  - Message: `refactor(client): extract agent color utility from AgentTree`
  - Files: `src/client/src/utils/agentColors.ts`
  - Pre-commit: `cd src/client && bun run tsc --noEmit`

---

- [ ] 2. Add Messages to /api/poll Endpoint

  **What to do**:
  - Modify `/api/poll` in `src/server/index.ts` to include messages for selected session
  - Add `sessionId` query parameter to `/api/poll`
  - If `sessionId` provided, fetch messages via `listMessages(sessionId)` 
  - If no `sessionId`, use `activeSession.id` if active session exists
  - Limit to 100 messages (already enforced by listMessages)
  - Include messages in response under `messages` key
  - Update `PollResponse` interface to include `messages: MessageMeta[]`

  **Must NOT do**:
  - Bulk load part files (too many)
  - Change polling interval
  - Break existing response structure (additive change only)
  - Add WebSocket

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Endpoint modification, uses existing parser
  - **Skills**: None needed
    - Uses existing `listMessages` function

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/server/index.ts:297-385` - Existing /api/poll implementation
  - `src/server/index.ts:205-223` - /api/sessions/:id/messages pattern to follow
  - `src/server/storage/messageParser.ts:115-143` - listMessages function

  **Type References**:
  - `src/shared/types/index.ts:25-36` - MessageMeta type definition
  - `src/server/index.ts:274-279` - PollResponse interface to extend

  **Acceptance Criteria**:

  ```bash
  # Start server and verify messages field in response
  bun run start &
  sleep 2
  curl -s "http://localhost:50234/api/poll" | jq 'has("messages")'
  # Should output: true
  ```

  ```bash
  # Verify messages is an array
  curl -s "http://localhost:50234/api/poll" | jq '.messages | type'
  # Should output: "array"
  ```

  ```bash
  # Run server tests
  bun test src/server
  # Should pass all tests
  ```

  **Evidence to Capture:**
  - [ ] curl output showing messages field exists
  - [ ] Test output showing all server tests pass

  **Commit**: YES
  - Message: `feat(server): add messages to /api/poll response`
  - Files: `src/server/index.ts`
  - Pre-commit: `bun test src/server`

---

- [ ] 3. Update AppContext with Messages State

  **What to do**:
  - Add `messages: MessageMeta[]` to `AppContextValue` interface
  - Add `selectedSessionMessages` derived state (messages for selected session)
  - Update `usePolling` hook's `PollResponse` type to include messages
  - Pass sessionId to poll endpoint based on `selectedSessionId`
  - Update polling URL to include `?sessionId=` query param

  **Must NOT do**:
  - Change polling interval (keep 2s)
  - Remove existing state fields
  - Add separate polling hook for messages

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: State addition, follows existing patterns
  - **Skills**: None needed
    - Uses existing React Context patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/client/src/store/AppContext.tsx:6-19` - Existing AppContextValue interface
  - `src/client/src/store/AppContext.tsx:29-33` - usePolling usage pattern
  - `src/client/src/hooks/usePolling.ts:4-9` - PollResponse interface

  **Type References**:
  - `src/shared/types/index.ts:25-36` - MessageMeta type

  **Acceptance Criteria**:

  ```bash
  # TypeScript compiles without errors
  cd src/client && bun run tsc --noEmit
  # Should exit 0
  ```

  ```bash
  # Run client tests
  cd src/client && bun run test --run
  # Should pass all tests
  ```

  **Evidence to Capture:**
  - [ ] tsc output showing no type errors
  - [ ] Test output showing all client tests pass

  **Commit**: YES
  - Message: `feat(client): add messages state to AppContext`
  - Files: `src/client/src/store/AppContext.tsx`, `src/client/src/hooks/usePolling.ts`
  - Pre-commit: `cd src/client && bun run tsc --noEmit`

---

- [ ] 4. Create LiveActivity Component

  **What to do**:
  - Create `src/client/src/components/LiveActivity.tsx`
  - Implement indented timeline visualization
  - Props: `messages: MessageMeta[]`, `loading: boolean`
  - Features:
    - Group messages by agent delegation (use parentID to build tree)
    - Color-coded agent badges using `getAgentColor()` from utils
    - Model display: `providerID/modelID` format
    - Relative timestamps (reuse pattern from SessionList)
    - Token usage display (if `message.tokens` exists)
    - Tool call placeholders (nested under parent message)
    - Auto-scroll to bottom on new messages (useRef + useEffect)
    - Empty state when no messages
    - Loading skeleton state
  - Styling: Follow existing Tailwind patterns, dark theme colors

  **Must NOT do**:
  - Use React Flow (simple DOM structure)
  - Fetch data directly (receives via props)
  - Implement actual tool call fetching (placeholder for now)
  - Add filtering/search UI

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with specific visual design requirements
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Component follows design system, needs visual polish

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/client/src/components/SessionList.tsx:15-24` - formatRelativeTime function pattern
  - `src/client/src/components/ToolCalls.tsx:23-34` - Status badge styling pattern
  - `src/client/src/components/AgentTree.tsx:60-68` - Agent color mapping (now in utils)
  - `src/client/src/components/EmptyState.tsx` - Empty state component to reuse
  - `src/client/src/components/LoadingSkeleton.tsx` - Loading skeleton patterns

  **Type References**:
  - `src/shared/types/index.ts:25-36` - MessageMeta interface

  **Styling References**:
  - `src/client/src/styles/index.css` or Tailwind config - Theme colors
  - Background: `#0d1117` (`bg-background`)
  - Surface: `#161b22` (`bg-surface`)
  - Accent: `#58a6ff` (`text-accent`)
  - Text: `#c9d1d9` (`text-text-primary`)

  **Visual Design Spec**:
  ```
  ┌─────────────────────────────────────────────────────────┐
  │ Live Activity                                           │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │ ├─ [prometheus] anthropic/claude-sonnet-4     10:30:05 │
  │ │   ↳ tokens: 1,234                                    │
  │ │   └─ mcp_read                            ✓ 10:30:06  │
  │ │   └─ mcp_write                           ⏳ 10:30:08 │
  │ │                                                       │
  │ ├─ [sisyphus] anthropic/claude-sonnet-4       10:30:10 │
  │ │   ↳ tokens: 567                                      │
  │ │   └─ mcp_bash                            ✓ 10:30:11  │
  │                                                         │
  │ ▼ (auto-scroll to bottom)                              │
  └─────────────────────────────────────────────────────────┘
  ```

  **Acceptance Criteria**:

  ```bash
  # File exists with correct exports
  cat src/client/src/components/LiveActivity.tsx | grep "export"
  # Should show: export const LiveActivity or export default LiveActivity
  ```

  ```bash
  # TypeScript compiles
  cd src/client && bun run tsc --noEmit
  # Should exit 0
  ```

  ```bash
  # Component renders without crashing (will test in Task 6)
  cd src/client && bun run test --run
  # Should pass
  ```

  **Evidence to Capture:**
  - [ ] TypeScript compilation success
  - [ ] Screenshot of component in dev server (manual verification)

  **Commit**: YES
  - Message: `feat(client): create LiveActivity timeline component`
  - Files: `src/client/src/components/LiveActivity.tsx`
  - Pre-commit: `cd src/client && bun run tsc --noEmit`

---

- [ ] 5. Wire LiveActivity to App.tsx

  **What to do**:
  - Import `LiveActivity` component in App.tsx
  - Replace `<AgentTree ... />` with `<LiveActivity ... />`
  - Pass props: `messages={messages}` from AppContext, `loading={loading}`
  - Remove AgentTree import
  - Optionally: Remove AgentTree.tsx file entirely OR keep for reference
  - Update ToolCalls panel if needed (or leave as placeholder for future)

  **Must NOT do**:
  - Change SessionList sidebar
  - Modify header or PlanProgress
  - Change overall layout structure
  - Remove ToolCalls panel (keep even if empty for now)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple wiring task, swap one component for another
  - **Skills**: None needed
    - Straightforward React component swap

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 3, 4

  **References**:

  **Pattern References**:
  - `src/client/src/App.tsx:89-100` - Current AgentTree usage to replace
  - `src/client/src/App.tsx:7` - Current AppContext usage pattern

  **Component References**:
  - `src/client/src/components/LiveActivity.tsx` - New component (from Task 4)
  - `src/client/src/store/AppContext.tsx` - Context with messages state (from Task 3)

  **Acceptance Criteria**:

  ```bash
  # Verify AgentTree is not imported
  grep -c "AgentTree" src/client/src/App.tsx
  # Should output: 0
  ```

  ```bash
  # Verify LiveActivity is imported
  grep "LiveActivity" src/client/src/App.tsx
  # Should show import and usage
  ```

  ```bash
  # TypeScript compiles
  cd src/client && bun run tsc --noEmit
  # Should exit 0
  ```

  ```bash
  # Dev server starts without errors
  cd src/client && timeout 10 bun run dev || true
  # Should start without crash (timeout is expected)
  ```

  **Evidence to Capture:**
  - [ ] grep output showing no AgentTree references
  - [ ] grep output showing LiveActivity usage
  - [ ] TypeScript compilation success

  **Commit**: YES
  - Message: `feat(client): replace AgentTree with LiveActivity in App`
  - Files: `src/client/src/App.tsx`
  - Pre-commit: `cd src/client && bun run tsc --noEmit`

---

- [ ] 6. Add LiveActivity Tests

  **What to do**:
  - Create `src/client/src/components/__tests__/LiveActivity.test.tsx`
  - Test cases:
    - Renders empty state when no messages
    - Renders loading skeleton when loading=true
    - Renders messages with agent badges
    - Agent badges have correct colors
    - Shows model info (providerID/modelID)
    - Shows token count when available
    - Shows relative timestamps
    - Messages ordered chronologically
  - Follow existing test patterns in `AgentTree.test.tsx`, `ToolCalls.test.tsx`

  **Must NOT do**:
  - Test auto-scroll behavior (hard to test, visual verification)
  - Test actual API integration (unit tests only)
  - Add E2E tests (out of scope)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Unit tests following existing patterns
  - **Skills**: None needed
    - Uses existing testing-library patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final task)
  - **Blocks**: None (final)
  - **Blocked By**: Tasks 4, 5

  **References**:

  **Test Pattern References**:
  - `src/client/src/components/__tests__/AgentTree.test.tsx` - Component test patterns
  - `src/client/src/components/__tests__/ToolCalls.test.tsx` - Mock data patterns
  - `src/client/src/components/__tests__/SessionList.test.tsx` - Rendering tests

  **Component Reference**:
  - `src/client/src/components/LiveActivity.tsx` - Component to test

  **Mock Data Shape**:
  ```typescript
  const mockMessages: MessageMeta[] = [
    {
      id: 'msg-1',
      sessionID: 'session-1',
      role: 'assistant',
      agent: 'prometheus',
      modelID: 'claude-sonnet-4',
      providerID: 'anthropic',
      tokens: 1234,
      createdAt: new Date('2024-01-15T10:30:00'),
    },
    // ...
  ];
  ```

  **Acceptance Criteria**:

  ```bash
  # Run LiveActivity tests specifically
  cd src/client && bun run test LiveActivity --run
  # Should pass all tests
  ```

  ```bash
  # Run all client tests
  cd src/client && bun run test --run
  # Should pass all tests including new ones
  ```

  **Evidence to Capture:**
  - [ ] Test output showing all LiveActivity tests pass
  - [ ] Test output showing all client tests pass

  **Commit**: YES
  - Message: `test(client): add LiveActivity component tests`
  - Files: `src/client/src/components/__tests__/LiveActivity.test.tsx`
  - Pre-commit: `cd src/client && bun run test --run`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `refactor(client): extract agent color utility from AgentTree` | utils/agentColors.ts | tsc --noEmit |
| 2 | `feat(server): add messages to /api/poll response` | server/index.ts | bun test src/server |
| 3 | `feat(client): add messages state to AppContext` | AppContext.tsx, usePolling.ts | tsc --noEmit |
| 4 | `feat(client): create LiveActivity timeline component` | LiveActivity.tsx | tsc --noEmit |
| 5 | `feat(client): replace AgentTree with LiveActivity in App` | App.tsx | tsc --noEmit |
| 6 | `test(client): add LiveActivity component tests` | LiveActivity.test.tsx | bun run test |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
bun test
cd src/client && bun run test --run

# TypeScript compiles
cd src/client && bun run tsc --noEmit

# Server returns messages in poll
curl -s http://localhost:50234/api/poll | jq '.messages | length'
# Expected: number >= 0

# Dev server runs
bun run dev
# Expected: No errors, accessible at localhost:5173
```

### Final Checklist
- [ ] LiveActivity component shows agent calls with color-coded badges
- [ ] Model info displayed as providerID/modelID
- [ ] Token usage shown when available
- [ ] Relative timestamps work correctly
- [ ] Empty state appears when no messages
- [ ] Loading skeleton appears during fetch
- [ ] AgentTree removed from App.tsx
- [ ] All existing tests still pass
- [ ] New LiveActivity tests pass
- [ ] No TypeScript errors
