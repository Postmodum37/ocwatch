# Activity Stream - Bottom Toolbar Redesign

## TL;DR

> **Quick Summary**: Replace the empty "Tool Calls" toolbar with a rich Activity Stream showing session-scoped tool calls, agent lifecycle events, and token usage with modern animations and agent filtering.
> 
> **Deliverables**:
> - New `ActivityStream.tsx` component replacing `ToolCalls.tsx`
> - `ActivityItem` union type for different activity kinds
> - Agent filter state in AppContext
> - CSS animations for slide-in and state changes
> - Tests for component and interactions
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (types) -> Task 2 (wire data) -> Task 3 (component) -> Task 5 (animations) -> Task 7 (tests)

---

## Context

### Original Request
User wanted to make the bottom toolbar useful. Currently shows "Tool Calls" with "No tool calls recorded yet" because data isn't wired. User wants a rich activity stream with:
- Tool calls + agent lifecycle + token usage
- Session-scoped, filterable by agent
- Click-to-expand rows
- Modern animations
- Summary bar when collapsed

### Interview Summary
**Key Discussions**:
- **Content richness**: Go rich - tools, spawns, completions, tokens
- **Visual design**: I decide, but "pretty and useful"
- **Selection model**: Default full session, then filter by agent in the activity view
- **Expand behavior**: Click to expand inline
- **Animations**: Yes, modern and sleek
- **History depth**: All session activity, virtualize if needed (defer virtualization for now)

**Research Findings**:
- `ToolCallSummary` already exists with: id, name, state, summary, input, timestamp, agentName
- `ActivitySession` has hierarchy info, status, tokens, toolCalls[]
- Root cause: `App.tsx:100` hardcodes `toolCalls={[]}` - data exists but not wired
- Project uses React Context, Tailwind CSS, Lucide icons
- `LiveActivity.tsx` has reusable patterns: StatusIndicator, formatRelativeTime, getAgentColor

### Metis Review
**Identified Gaps** (addressed):
- Data not wired (hardcoded empty array) -> Task 2 fixes this
- Agent lifecycle events don't exist as explicit type -> Task 1 creates ActivityItem union
- No virtualization library -> Deferred, not needed for v1
- 50 tool call limit may be insufficient -> Acceptable for v1, can increase later

---

## Work Objectives

### Core Objective
Create a polished Activity Stream component that replaces the bottom toolbar, showing rich session activity with agent filtering and smooth animations.

### Concrete Deliverables
- `src/client/src/components/ActivityStream.tsx` - New main component
- `src/client/src/components/ActivityRow.tsx` - Expandable activity row
- `src/shared/types/index.ts` - ActivityItem type additions
- `src/client/src/store/AppContext.tsx` - agentFilter state
- `src/client/src/App.tsx` - Wire new component with real data
- `src/client/src/styles/animations.css` - Animation keyframes
- `src/client/src/components/__tests__/ActivityStream.test.tsx` - Component tests

### Definition of Done
- [x] Activity stream renders with real tool call data (not empty)
- [x] Agent filter chips work (click to filter, click again to clear)
- [x] Rows expand on click to show details
- [x] New items animate in (slide-down)
- [x] State changes pulse (pending -> complete)
- [x] Summary bar shows aggregate stats when collapsed
- [x] All existing tests pass
- [x] New component tests pass

### Must Have
- Tool call activity from session data
- Agent spawn/complete lifecycle events (synthesized from session tree)
- Clickable agent filter chips
- Click-to-expand rows
- Slide-in animation for new items
- Summary bar when collapsed

### Must NOT Have (Guardrails)
- **No new npm dependencies** for animations - CSS transitions only
- **No new state management** - stay with React Context
- **No virtualization** for v1 - defer unless explicitly needed
- **No token cost estimation** - show raw token counts only
- **No search or filter persistence** - simple toggle chips only
- **No nested/recursive expansion** - single level expand only
- **No backend/API changes** - frontend only
- **No framer-motion, react-spring, or similar** - Tailwind transitions only

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest with jsdom)
- **User wants tests**: YES (tests after implementation)
- **Framework**: Vitest

### Automated Verification

Each TODO includes executable verification that agents can run directly.

**By Deliverable Type:**

| Type | Verification Tool | Automated Procedure |
|------|------------------|---------------------|
| **TypeScript types** | `bun run tsc -b` | Build succeeds, no type errors |
| **React component** | Vitest | Component tests pass |
| **Integration** | Playwright | Panel visible, interactions work |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Create ActivityItem types
└── Task 4: Add CSS animation keyframes

Wave 2 (After Wave 1):
├── Task 2: Wire data in App.tsx (depends: 1)
├── Task 3: Build ActivityStream component (depends: 1, 4)
└── Task 6: Add agent filter state to AppContext (depends: 1)

Wave 3 (After Wave 2):
├── Task 5: Wire ActivityStream in App.tsx (depends: 2, 3, 6)
└── Task 7: Write tests (depends: 3, 5)

Wave 4 (After Wave 3):
└── Task 8: Final integration and polish (depends: all)
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3, 6 | 4 |
| 4 | None | 3 | 1 |
| 2 | 1 | 5 | 3, 6 |
| 3 | 1, 4 | 5, 7 | 2, 6 |
| 6 | 1 | 5 | 2, 3 |
| 5 | 2, 3, 6 | 7, 8 | None |
| 7 | 3, 5 | 8 | None |
| 8 | All | None | None |

---

## TODOs

- [x] 1. Create ActivityItem types and helpers

  **What to do**:
  - Add `ActivityItem` union type to `src/shared/types/index.ts`
  - Types: `ToolCallActivity`, `AgentSpawnActivity`, `AgentCompleteActivity`
  - Add `ActivityType` enum: `'tool-call' | 'agent-spawn' | 'agent-complete'`
  - Each activity has: `id`, `type`, `timestamp`, `agentName`, plus type-specific fields
  - Add helper function `synthesizeActivityItems(sessions: ActivitySession[]): ActivityItem[]`

  **Must NOT do**:
  - Don't add error activity type (use tool-call with error state)
  - Don't add message/thinking activity types (out of scope)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, focused type definitions with clear structure
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Type design for UI data structures

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 4)
  - **Blocks**: Tasks 2, 3, 6
  - **Blocked By**: None

  **References**:
  - `src/shared/types/index.ts:101-121` - Existing ToolCall and ToolCallSummary types to extend/compose with
  - `src/shared/types/index.ts:43-59` - ActivitySession type showing available fields for lifecycle events
  - `src/client/src/components/LiveActivity.tsx:34-65` - buildSessionTree() shows how to traverse hierarchy for spawn events

  **Acceptance Criteria**:
  ```bash
  # Type check passes
  cd /Users/tomas/Workspace/ocwatch && bun run tsc -b
  # Assert: Exit code 0, no errors
  ```

  **Commit**: YES
  - Message: `feat(types): add ActivityItem union type for activity stream`
  - Files: `src/shared/types/index.ts`
  - Pre-commit: `bun run tsc -b`

---

- [x] 2. Wire tool calls data to component props

  **What to do**:
  - In `App.tsx`, replace `toolCalls={[]}` with actual data from `activitySessions`
  - Collect all tool calls from all activity sessions into a flat array
  - **IMPORTANT TYPE MAPPING**: `activitySessions[].toolCalls` is `ToolCallSummary[]` but `ToolCalls` expects `ToolCall[]`. Map the data:
    ```typescript
    const toolCalls: ToolCall[] = activitySessions.flatMap(session => 
      (session.toolCalls || []).map(tc => ({
        id: tc.id,
        name: tc.name,
        state: tc.state,
        timestamp: new Date(tc.timestamp), // ToolCallSummary.timestamp is string, ToolCall.timestamp is Date
        sessionID: session.id,
        messageID: tc.id, // Use tool call ID as proxy since messageID not in summary
      }))
    );
    ```
  - Pass to ToolCalls component (temporary, will be replaced by ActivityStream in Task 5)
  - This ensures data flows before building new component

  **Must NOT do**:
  - Don't modify the ToolCalls component itself
  - Don't add filtering logic yet (Task 6)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file change, simple data wiring
  - **Skills**: []
    - No special skills needed for basic prop passing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 6)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:
  - `src/client/src/App.tsx:99-103` - Current hardcoded empty array to replace
  - `src/client/src/App.tsx:14` - activitySessions available from useAppContext()
  - `src/shared/types/index.ts:56` - ActivitySession.toolCalls field
  - `src/client/src/components/ToolCalls.tsx:5-9` - ToolCallsProps interface expecting ToolCall[]

  **Acceptance Criteria**:
  ```bash
  # Build succeeds
  cd /Users/tomas/Workspace/ocwatch && bun run tsc -b
  # Assert: Exit code 0

  # Dev server starts (visual check that data flows)
  # In browser: Bottom panel should show tool calls if any sessions have them
  ```

  **Commit**: YES
  - Message: `fix(app): wire tool calls data from activity sessions`
  - Files: `src/client/src/App.tsx`
  - Pre-commit: `bun run tsc -b`

---

- [x] 3. Build ActivityStream component

  **What to do**:
  - Create `src/client/src/components/ActivityStream.tsx`
  - Create `src/client/src/components/ActivityRow.tsx` for expandable rows
  - **Collapsed state**: Summary bar showing "X calls - Y agents - Z tokens"
  - **Expanded state**: Scrollable list of activity items
  - **Header**: Title + agent filter chips (pills with agent colors)
  - **ActivityRow**: Shows timestamp, agent badge, activity type icon, summary text
  - **Expand on click**: Shows full input details, output preview
  - Use `getAgentColor()` from existing utils for consistent agent colors
  - Use Lucide icons: Terminal, FileText, FileEdit, Search, Globe, ArrowDownRight, Check, X
  - Status indicators: filled circle (complete), half circle (pending), X (error), arrow (spawn), checkmark (agent complete)

  **Must NOT do**:
  - Don't implement filtering logic (that's in AppContext, Task 6)
  - Don't add virtualization
  - Don't add search

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with visual design requirements, animations, interactions
  - **Skills**: [`frontend-ui-ux`, `design-principles`]
    - `frontend-ui-ux`: Component structure, React patterns
    - `design-principles`: Clean, modern, Linear-inspired design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 6)
  - **Blocks**: Tasks 5, 7
  - **Blocked By**: Tasks 1, 4

  **References**:
  - `src/client/src/components/ToolCalls.tsx` - Current component to replace, copy expand/collapse pattern
  - `src/client/src/components/LiveActivity.tsx:67-95` - StatusIndicator component to reuse
  - `src/client/src/components/LiveActivity.tsx:117-258` - SessionRow for row layout patterns
  - `src/client/src/components/ToolCallRow.tsx` - Existing tool call row component to reference
  - `src/client/src/utils/agentColors.ts` - getAgentColor() for consistent agent badge colors
  - `src/client/src/components/LiveActivity.tsx:14-27` - formatRelativeTime() helper to reuse

  **Acceptance Criteria**:
  ```bash
  # TypeScript compiles
  cd /Users/tomas/Workspace/ocwatch && bun run tsc -b
  # Assert: Exit code 0

  # Component file exists with expected exports
  test -f src/client/src/components/ActivityStream.tsx && echo "ActivityStream exists"
  test -f src/client/src/components/ActivityRow.tsx && echo "ActivityRow exists"
  # Assert: Both files exist
  ```

  **Commit**: YES
  - Message: `feat(ui): add ActivityStream and ActivityRow components`
  - Files: `src/client/src/components/ActivityStream.tsx`, `src/client/src/components/ActivityRow.tsx`
  - Pre-commit: `bun run tsc -b`

---

- [x] 4. Add CSS animation keyframes

  **What to do**:
  - Create `src/client/src/styles/animations.css` with keyframes
  - Add `@keyframes slide-in-from-top` - for new items appearing
  - Add `@keyframes pulse-bg` - for state change highlighting
  - Add `@keyframes fade-in` - for expand/collapse content
  - Import in `src/client/src/main.tsx` or `index.css`
  - Use Tailwind-compatible timing: 200ms, 300ms, ease-out

  **Animation specs**:
  ```css
  /* New item slides down from top */
  @keyframes slide-in-from-top {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  /* Background pulse for state changes */
  @keyframes pulse-bg {
    0%, 100% { background-color: transparent; }
    50% { background-color: rgba(88, 166, 255, 0.1); }
  }
  
  /* Fade in for expanded content */
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  ```

  **Must NOT do**:
  - Don't add any npm dependencies
  - Don't use CSS-in-JS
  - Don't add complex physics-based animations

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small CSS file with clear specs
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: CSS animation patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: None

  **References**:
  - `src/client/src/index.css` - Existing global styles, import animations here
  - `src/client/src/main.tsx` - Entry point if separate import needed
  - `tailwind.config.js` - Theme colors for animation colors (accent: #58a6ff)

  **Acceptance Criteria**:
  ```bash
  # File exists
  test -f src/client/src/styles/animations.css && echo "Animations file exists"
  # Assert: File exists
  
  # Build succeeds with CSS import
  cd /Users/tomas/Workspace/ocwatch && bun run build
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `feat(styles): add CSS animations for activity stream`
  - Files: `src/client/src/styles/animations.css`, `src/client/src/index.css`
  - Pre-commit: `bun run build`

---

- [x] 5. Integrate ActivityStream in App.tsx

  **What to do**:
  - Replace `<ToolCalls>` import with `<ActivityStream>`
  - Pass required props: activitySessions, agentFilter, onAgentFilterChange
  - Use synthesizeActivityItems() to convert sessions to activity items
  - Remove old ToolCalls component file (or keep for reference)

  **Must NOT do**:
  - Don't modify ActivityStream component (already built in Task 3)
  - Don't change other parts of App.tsx layout

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple component swap and prop wiring
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Tasks 2, 3, 6

  **References**:
  - `src/client/src/App.tsx:3` - Current ToolCalls import to replace
  - `src/client/src/App.tsx:99-103` - Current ToolCalls usage to replace
  - `src/client/src/store/AppContext.tsx` - Where agentFilter state comes from (Task 6)
  - `src/client/src/components/ActivityStream.tsx` - New component (Task 3)

  **Acceptance Criteria**:
  ```bash
  # Build succeeds
  cd /Users/tomas/Workspace/ocwatch && bun run tsc -b
  # Assert: Exit code 0
  
  # Client tests still pass
  cd /Users/tomas/Workspace/ocwatch/src/client && bun run test
  # Assert: All tests pass (some may need updates)
  ```

  **Commit**: YES
  - Message: `feat(app): replace ToolCalls with ActivityStream component`
  - Files: `src/client/src/App.tsx`
  - Pre-commit: `bun run tsc -b`

---

- [x] 6. Add agent filter state to AppContext

  **What to do**:
  - Add `agentFilter: string[]` to AppContextValue interface
  - Add `setAgentFilter: (agents: string[]) => void` setter
  - Initialize as empty array (no filter = show all)
  - Filter logic: if empty, show all; if has values, show only matching agentName

  **Must NOT do**:
  - Don't add persistence (localStorage, URL params)
  - Don't add complex filter operators (AND/OR)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple state addition to existing context
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:
  - `src/client/src/store/AppContext.tsx:6-21` - AppContextValue interface to extend
  - `src/client/src/store/AppContext.tsx:31-38` - useState pattern for state
  - `src/client/src/store/AppContext.tsx:76-91` - Context value object to extend

  **Acceptance Criteria**:
  ```bash
  # TypeScript compiles
  cd /Users/tomas/Workspace/ocwatch && bun run tsc -b
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `feat(state): add agent filter state to AppContext`
  - Files: `src/client/src/store/AppContext.tsx`
  - Pre-commit: `bun run tsc -b`

---

- [x] 7. Write component tests

  **What to do**:
  - Create `src/client/src/components/__tests__/ActivityStream.test.tsx`
  - Test: renders with empty data (empty state)
  - Test: renders activity items when data provided
  - Test: filter chips show unique agents
  - Test: clicking filter chip calls setAgentFilter
  - Test: clicking row expands to show details
  - Test: collapsed state shows summary bar
  - Update or remove `ToolCalls.test.tsx` if ToolCalls is removed

  **Must NOT do**:
  - Don't test animations (CSS, hard to test)
  - Don't test implementation details

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard component tests following existing patterns
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after component is integrated)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 3, 5

  **References**:
  - `src/client/src/components/__tests__/ToolCalls.test.tsx` - Existing test patterns to follow
  - `src/client/src/components/__tests__/LiveActivity.test.tsx` - More test examples if exists
  - `src/client/vite.config.ts` - Vite config (includes Vitest test configuration)

  **Acceptance Criteria**:
  ```bash
  # All client tests pass
  cd /Users/tomas/Workspace/ocwatch/src/client && bun run test
  # Assert: All tests pass, including new ActivityStream tests
  ```

  **Commit**: YES
  - Message: `test(activity-stream): add component tests`
  - Files: `src/client/src/components/__tests__/ActivityStream.test.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [x] 8. Final integration and polish

  **What to do**:
  - Run full build and verify no errors
  - Run all tests and verify passing
  - Manual smoke test in browser:
    - Panel renders at bottom
    - Collapsed shows summary
    - Expanded shows activity list
    - Filter chips work
    - Rows expand on click
    - Animations are smooth
  - Clean up any unused imports or dead code
  - Remove ToolCalls.tsx if fully replaced

  **Must NOT do**:
  - Don't add new features
  - Don't refactor unrelated code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and cleanup, no new implementation
  - **Skills**: [`playwright`]
    - `playwright`: For browser verification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None
  - **Blocked By**: All previous tasks

  **References**:
  - `src/client/src/components/ToolCalls.tsx` - Remove if replaced
  - `src/client/src/components/__tests__/ToolCalls.test.tsx` - Remove if ToolCalls removed

  **Acceptance Criteria**:
  ```bash
  # Full build succeeds
  cd /Users/tomas/Workspace/ocwatch && bun run build
  # Assert: Exit code 0
  
  # All tests pass
  cd /Users/tomas/Workspace/ocwatch && bun test
  cd /Users/tomas/Workspace/ocwatch/src/client && bun run test
  # Assert: All pass
  ```

  **For Browser Verification** (using playwright skill):
  ```
  1. Navigate to: http://localhost:5173
  2. Assert: [data-testid="activity-stream-panel"] is visible
  3. Click: panel header to expand
  4. Assert: activity items or empty state visible
  5. Screenshot: .sisyphus/evidence/activity-stream-final.png
  ```

  **Commit**: YES
  - Message: `chore: remove deprecated ToolCalls component`
  - Files: Remove `src/client/src/components/ToolCalls.tsx`, `src/client/src/components/__tests__/ToolCalls.test.tsx`
  - Pre-commit: `bun run build && bun test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(types): add ActivityItem union type` | types/index.ts | tsc -b |
| 2 | `fix(app): wire tool calls data` | App.tsx | tsc -b |
| 3 | `feat(ui): add ActivityStream components` | ActivityStream.tsx, ActivityRow.tsx | tsc -b |
| 4 | `feat(styles): add CSS animations` | animations.css, index.css | build |
| 5 | `feat(app): replace ToolCalls with ActivityStream` | App.tsx | tsc -b |
| 6 | `feat(state): add agent filter state` | AppContext.tsx | tsc -b |
| 7 | `test(activity-stream): add component tests` | ActivityStream.test.tsx | test |
| 8 | `chore: remove deprecated ToolCalls` | remove ToolCalls.tsx | build + test |

---

## Success Criteria

### Verification Commands
```bash
# Build
cd /Users/tomas/Workspace/ocwatch && bun run build
# Expected: Exit code 0

# Server tests
cd /Users/tomas/Workspace/ocwatch && bun test
# Expected: All pass

# Client tests
cd /Users/tomas/Workspace/ocwatch/src/client && bun run test
# Expected: All pass including new ActivityStream tests
```

### Final Checklist
- [x] Activity stream shows real data (not "No tool calls recorded yet")
- [x] Agent filter chips appear and work
- [x] Rows expand on click
- [x] Animations are smooth (200-300ms)
- [x] Summary bar shows when collapsed
- [x] No new npm dependencies added
- [x] All tests pass
- [x] Build succeeds
