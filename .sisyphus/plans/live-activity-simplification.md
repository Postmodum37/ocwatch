# Live Activity UI Simplification

## TL;DR

> **Quick Summary**: Simplify LiveActivity component by removing expandable tool calls, showing only current action per session in flat row style while preserving hierarchy, and enhancing agent badges with gradient/glow effects.
> 
> **Deliverables**:
> - Refactored `LiveActivity.tsx` with simplified SessionRow (no expansion)
> - Enhanced agent badge component with gradient/glow styling
> - Updated tests reflecting removed expansion behavior
> - Potentially deprecated `ToolCallRow.tsx` (no longer used by LiveActivity)
> 
> **Estimated Effort**: Medium (3-4 hours)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 3 → Task 4

---

## Context

### Original Request
Modify the Live Activity window in OCWatch to:
1. Remove expandable tool calls - just show the current action happening
2. Make it visually similar to Activity stream entries UI/UX style (flat rows, not tree)
3. Make agents appear more nicely and intricate

### Interview Summary
**Key Discussions**:
- **Hierarchy**: Keep tree connectors (└─, ├─) and indentation, but simplify each row
- **Action Display**: Show action text + most recent tool call as secondary info (NOT expandable list)
- **Agent Badges**: Enhanced pill with gradients, inner glow/shadow, depth effects
- **Row Content**: Keep ALL info - agent badge, action/tool, status, time, model/provider, tokens

**Research Findings**:
- `LiveActivity.tsx`: 326 lines, `SessionRow` (117-259) contains expansion logic to remove
- `ToolCallRow.tsx`: 107 lines, used for expandable tool calls - will be unused after this
- `ActivityRow.tsx`: 166 lines, provides reference for flat row styling patterns
- `agentColors.ts`: 22 lines, color constants to leverage for enhanced badges
- `LiveActivity.test.tsx`: 420 lines, has tests for expand/collapse that need updating
- `animations.css`: Has `animate-slide-in-from-top` animation available
- `tailwind.config.js`: Has project color palette defined

### Gap Analysis (Self-Review)

**Identified Gaps (addressed in plan)**:
1. Test file updates needed - expansion tests will fail after changes
2. ToolCallRow.tsx becomes orphaned - decide: delete or keep for future use
3. CSS for enhanced badges needs specific implementation details
4. Screen reader accessibility for enhanced badges

---

## Work Objectives

### Core Objective
Transform LiveActivity from an expandable tree view to a simplified flat-row display (preserving hierarchy visually) with enhanced agent badge styling.

### Concrete Deliverables
- `src/client/src/components/LiveActivity.tsx` - Refactored SessionRow component
- `src/client/src/components/AgentBadge.tsx` - New enhanced badge component (extracted)
- `src/client/src/components/__tests__/LiveActivity.test.tsx` - Updated tests
- `src/client/src/styles/animations.css` - Badge animation/glow styles (optional)

### Definition of Done
- [ ] LiveActivity renders sessions with hierarchy but NO expandable tool calls
- [ ] Each session shows: agent badge, current action, tool info, status, time, model, tokens
- [ ] Agent badges have gradient background + subtle glow effect
- [ ] All existing visual tests pass (updated for new behavior)
- [ ] `bun run test` in client passes

### Must Have
- Preserved session hierarchy visualization (└─, ├─ connectors)
- Single-line rows (no expansion)
- Current action + most recent tool info inline
- Enhanced agent badges with visual polish
- All existing info preserved (status, time, model, tokens)

### Must NOT Have (Guardrails)
- **NO expandable tool call lists** - removed entirely
- **NO "Show N more" pagination** - removed
- **NO ToolCallRow usage** in LiveActivity
- **NO new dependencies** - use existing Tailwind + inline styles
- **NO changes to data structures** (ActivitySession, ToolCallSummary remain unchanged)
- **NO changes to API/backend** - frontend-only refactor
- **NO ActivityRow.tsx modifications** - use as reference only, don't touch it
- **NO scope creep** - don't add filtering, search, or new features

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest with jsdom)
- **User wants tests**: YES (update existing tests)
- **Framework**: Vitest (`bun run test` in client directory)

### Verification Approach
Each TODO includes automated verification that agents can execute:

**For UI changes** (using dev server + visual inspection):
```bash
# Start dev server
cd /Users/tomas/Workspace/ocwatch && bun run dev

# Agent verifies via browser automation:
# 1. Navigate to http://localhost:5173
# 2. Select a session with tool calls
# 3. Assert: No expand/collapse chevrons visible
# 4. Assert: Agent badge has gradient background (inspect CSS)
# 5. Assert: Current action text visible inline
```

**For test updates**:
```bash
cd /Users/tomas/Workspace/ocwatch/src/client && bun run test
# Assert: All tests pass
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Create AgentBadge component with enhanced styling
└── Task 2: Add badge CSS animations/glow to animations.css

Wave 2 (After Wave 1):
└── Task 3: Refactor LiveActivity.tsx SessionRow (uses AgentBadge)

Wave 3 (After Wave 2):
└── Task 4: Update LiveActivity.test.tsx

Wave 4 (Final):
└── Task 5: Verify and cleanup (ToolCallRow deprecation note)
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3 | 2 |
| 2 | None | 3 | 1 |
| 3 | 1, 2 | 4 | None |
| 4 | 3 | 5 | None |
| 5 | 4 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Approach |
|------|-------|---------------------|
| 1 | 1, 2 | Run in parallel - independent CSS/component work |
| 2 | 3 | Main refactoring - depends on badge component |
| 3 | 4 | Test updates - depends on component behavior |
| 4 | 5 | Verification - final cleanup |

---

## TODOs

- [ ] 1. Create AgentBadge Component with Enhanced Styling

  **What to do**:
  - Create new file `src/client/src/components/AgentBadge.tsx`
  - Extract badge rendering from current SessionRow
  - Implement enhanced visual styling:
    - Gradient background using agent color (lighter → base → slightly darker)
    - Subtle inner shadow for depth (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.1)`)
    - Subtle outer glow on hover or when working (`box-shadow: 0 0 8px {color}40`)
    - Slightly larger: `px-2.5 py-1 text-xs font-semibold`
    - Rounded corners: `rounded-md`
  - Accept props: `agent: string`, `status?: SessionStatus`, `className?: string`
  - Use `getAgentColor()` from existing utils

  **Must NOT do**:
  - Don't add icons to badges (keep text-only per current design)
  - Don't make badges clickable/interactive
  - Don't import new dependencies

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Component creation with CSS styling focus
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Needed for polished visual design implementation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/client/src/components/LiveActivity.tsx:179-184` - Current badge rendering to extract and enhance
  - `src/client/src/components/ActivityRow.tsx:136-140` - Agent dot styling reference (simpler alternative)

  **API/Type References**:
  - `src/shared/types/index.ts:6` - `SessionStatus` type for status-aware styling
  - `src/client/src/utils/agentColors.ts:1-11` - `getAgentColor()` function to use

  **Style References**:
  - `src/client/tailwind.config.js:7-17` - Project color palette (background, surface, accent)

  **WHY Each Reference Matters**:
  - `LiveActivity.tsx:179-184`: Shows current badge structure to maintain API compatibility
  - `agentColors.ts`: Required for consistent agent coloring across the app
  - `tailwind.config.js`: Ensures colors match project theme

  **Acceptance Criteria**:

  **Automated Verification**:
  ```bash
  # File exists and has correct structure
  test -f /Users/tomas/Workspace/ocwatch/src/client/src/components/AgentBadge.tsx && echo "FILE_EXISTS"
  # Assert: Output contains "FILE_EXISTS"
  
  # TypeScript compiles
  cd /Users/tomas/Workspace/ocwatch/src/client && bun run tsc --noEmit
  # Assert: Exit code 0
  ```

  **Visual Verification** (via browser):
  ```
  1. Import AgentBadge in App.tsx temporarily for testing
  2. Render: <AgentBadge agent="prometheus" status="working" />
  3. Assert: Badge has purple gradient background
  4. Assert: Badge has subtle glow effect
  5. Screenshot: .sisyphus/evidence/task-1-badge-visual.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add AgentBadge component with enhanced gradient styling`
  - Files: `src/client/src/components/AgentBadge.tsx`
  - Pre-commit: `cd src/client && bun run tsc --noEmit`

---

- [ ] 2. Add Badge Glow Animation to CSS

  **What to do**:
  - Add to `src/client/src/styles/animations.css`:
    - `@keyframes badge-glow` - pulsing glow for working status
    - `.animate-badge-glow` - utility class
  - Glow should use CSS custom property `--badge-color` for dynamic coloring

  **CSS to add**:
  ```css
  @keyframes badge-glow {
    0%, 100% {
      box-shadow: 0 0 4px var(--badge-color, rgba(88, 166, 255, 0.3));
    }
    50% {
      box-shadow: 0 0 12px var(--badge-color, rgba(88, 166, 255, 0.5));
    }
  }
  
  .animate-badge-glow {
    animation: badge-glow 2s ease-in-out infinite;
  }
  ```

  **Must NOT do**:
  - Don't modify existing animations
  - Don't add animations unrelated to badges

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small CSS addition, straightforward task
  - **Skills**: []
    - No special skills needed for simple CSS

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/client/src/styles/animations.css:1-47` - Existing animation patterns to follow

  **WHY Each Reference Matters**:
  - `animations.css`: Follow existing keyframe and utility class naming conventions

  **Acceptance Criteria**:

  **Automated Verification**:
  ```bash
  # Check CSS contains new animation
  grep -q "badge-glow" /Users/tomas/Workspace/ocwatch/src/client/src/styles/animations.css && echo "ANIMATION_EXISTS"
  # Assert: Output contains "ANIMATION_EXISTS"
  
  grep -q "animate-badge-glow" /Users/tomas/Workspace/ocwatch/src/client/src/styles/animations.css && echo "CLASS_EXISTS"
  # Assert: Output contains "CLASS_EXISTS"
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `feat(ui): add badge glow animation for working status`
  - Files: `src/client/src/styles/animations.css`

---

- [ ] 3. Refactor LiveActivity.tsx SessionRow Component

  **What to do**:
  - Remove expansion-related state: `toolsExpanded`, `showAllTools`
  - Remove expansion-related JSX: chevron icons, onClick handlers for expansion
  - Remove tool call list rendering (lines 220-246)
  - Remove `ToolCallRow` import
  - Import and use new `AgentBadge` component
  - Simplify row to single-line layout:
    - Keep: tree connectors (└─, ├─) for hierarchy at depth > 0
    - Keep: status indicator
    - Replace: inline badge with `<AgentBadge agent={session.agent} status={status} />`
    - Keep: current action text (truncated)
    - Keep: tool info line (toolName + toolArg) - but NOT expandable
    - Keep: model/provider, time, tokens on right side
  - Remove `cursor-pointer` class (rows are no longer clickable)
  - Keep `data-testid` attributes for testing

  **Structure after refactor**:
  ```tsx
  <div className="flex items-center gap-2 py-1.5 hover:bg-white/[0.02] rounded px-2 -mx-2">
    {/* Tree connector if depth > 0 */}
    {depth > 0 && <TreeConnector isLast={isLast} />}
    
    {/* Status indicator */}
    <StatusIndicator status={status} />
    
    {/* Agent badge (enhanced) */}
    <AgentBadge agent={session.agent} status={status} />
    
    {/* Content */}
    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
      <span className="text-text-secondary text-xs truncate">{truncatedAction}</span>
      {toolInfo && (
        <span className="text-xs text-gray-500 font-mono truncate">
          {toolInfo.toolName} {toolInfo.toolArg}
        </span>
      )}
    </div>
    
    {/* Meta info */}
    <div className="flex flex-col items-end shrink-0 text-xs">
      {/* model/provider */}
      {/* time + tokens */}
    </div>
  </div>
  ```

  **Must NOT do**:
  - Don't remove the tree-building logic (`buildSessionTree`)
  - Don't change `ActivitySession` type
  - Don't modify helper functions (`formatRelativeTime`, `extractPrimaryArg`, `getFullToolDisplayText`)
  - Don't remove StatusIndicator component
  - Don't add new features (filtering, sorting, etc.)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI refactoring with styling considerations
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Needed for maintaining visual quality during refactor

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1, Task 2

  **References**:

  **Pattern References**:
  - `src/client/src/components/LiveActivity.tsx:117-259` - Current SessionRow to refactor (FULL CONTEXT)
  - `src/client/src/components/ActivityRow.tsx:118-164` - Target flat row style reference
  - `src/client/src/components/LiveActivity.tsx:67-95` - StatusIndicator to keep unchanged

  **API/Type References**:
  - `src/shared/types/index.ts:44-59` - ActivitySession type (don't modify)
  - `src/shared/types/index.ts:113-121` - ToolCallSummary type (keep using for toolInfo)

  **Import Changes**:
  - Remove: `import { ToolCallRow } from './ToolCallRow';`
  - Remove: `ChevronRight, ChevronDown` from lucide-react imports
  - Add: `import { AgentBadge } from './AgentBadge';`

  **WHY Each Reference Matters**:
  - `LiveActivity.tsx:117-259`: The exact code to refactor - understand current structure
  - `ActivityRow.tsx:118-164`: Shows target flat row pattern to emulate
  - `StatusIndicator`: Must preserve unchanged for consistent status display

  **Acceptance Criteria**:

  **Automated Verification**:
  ```bash
  # TypeScript compiles
  cd /Users/tomas/Workspace/ocwatch/src/client && bun run tsc --noEmit
  # Assert: Exit code 0
  
  # No ToolCallRow import
  ! grep -q "import.*ToolCallRow" /Users/tomas/Workspace/ocwatch/src/client/src/components/LiveActivity.tsx && echo "NO_TOOLCALLROW_IMPORT"
  # Assert: Output contains "NO_TOOLCALLROW_IMPORT"
  
  # No toolsExpanded state
  ! grep -q "toolsExpanded" /Users/tomas/Workspace/ocwatch/src/client/src/components/LiveActivity.tsx && echo "NO_EXPANSION_STATE"
  # Assert: Output contains "NO_EXPANSION_STATE"
  
  # AgentBadge is imported
  grep -q "import.*AgentBadge" /Users/tomas/Workspace/ocwatch/src/client/src/components/LiveActivity.tsx && echo "AGENTBADGE_IMPORTED"
  # Assert: Output contains "AGENTBADGE_IMPORTED"
  ```

  **Visual Verification** (via browser):
  ```
  1. Navigate to http://localhost:5173
  2. View Live Activity panel with active sessions
  3. Assert: Sessions display with hierarchy (└─ connectors visible)
  4. Assert: No chevron expand icons visible
  5. Assert: Clicking row does NOT expand tool list
  6. Assert: Agent badges have gradient styling
  7. Assert: Current action + tool info visible inline
  8. Screenshot: .sisyphus/evidence/task-3-live-activity.png
  ```

  **Commit**: YES
  - Message: `refactor(ui): simplify LiveActivity to single-line rows, remove expansion`
  - Files: `src/client/src/components/LiveActivity.tsx`
  - Pre-commit: `cd src/client && bun run tsc --noEmit`

---

- [ ] 4. Update LiveActivity.test.tsx

  **What to do**:
  - Remove tests for expansion behavior:
    - `'agent row with toolCalls shows tool call list'` (line 215)
    - `'default shows max 5 tool calls'` (line 247)
    - `'click agent row expands to show all tool calls'` (line 277)
    - `'click agent row again collapses to last 5 tool calls'` (line 311)
  - Update test for sessions with tool calls - verify inline display instead of expansion
  - Remove mock for `ChevronRight`, `ChevronDown` if no longer used
  - Add test: "agent row shows tool info inline without expansion"
  - Keep all other tests unchanged (hierarchy, status, time formatting, etc.)

  **Must NOT do**:
  - Don't remove tests unrelated to expansion
  - Don't change test utilities or setup

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Test file updates, straightforward removals and additions
  - **Skills**: []
    - No special skills needed for test updates

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 5
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `src/client/src/components/__tests__/LiveActivity.test.tsx:215-344` - Tests to remove/update
  - `src/client/src/components/__tests__/LiveActivity.test.tsx:363-387` - Tool info inline test pattern

  **Test References**:
  - `src/client/src/components/__tests__/LiveActivity.test.tsx:10-17` - Existing mocks to update

  **WHY Each Reference Matters**:
  - `LiveActivity.test.tsx:215-344`: Exact tests to remove (expansion behavior)
  - `LiveActivity.test.tsx:363-387`: Pattern for tool info test to keep/adapt

  **Acceptance Criteria**:

  **Automated Verification**:
  ```bash
  # All tests pass
  cd /Users/tomas/Workspace/ocwatch/src/client && bun run test
  # Assert: Exit code 0, all tests pass
  
  # No expansion-related test descriptions
  ! grep -q "expands to show all tool calls" /Users/tomas/Workspace/ocwatch/src/client/src/components/__tests__/LiveActivity.test.tsx && echo "NO_EXPAND_TEST"
  # Assert: Output contains "NO_EXPAND_TEST"
  
  ! grep -q "collapses to last 5" /Users/tomas/Workspace/ocwatch/src/client/src/components/__tests__/LiveActivity.test.tsx && echo "NO_COLLAPSE_TEST"
  # Assert: Output contains "NO_COLLAPSE_TEST"
  ```

  **Commit**: YES
  - Message: `test(ui): update LiveActivity tests for simplified non-expandable rows`
  - Files: `src/client/src/components/__tests__/LiveActivity.test.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [ ] 5. Final Verification and Cleanup

  **What to do**:
  - Run full test suite to ensure nothing is broken
  - Verify visual appearance in browser
  - Add deprecation comment to `ToolCallRow.tsx` header:
    ```tsx
    /**
     * @deprecated This component is no longer used by LiveActivity.
     * Kept for potential future use or can be removed in cleanup.
     */
    ```
  - Verify no TypeScript errors across project

  **Must NOT do**:
  - Don't delete ToolCallRow.tsx (might be used elsewhere or in future)
  - Don't make additional feature changes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and minor comment addition
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None (final task)
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `src/client/src/components/ToolCallRow.tsx:1-10` - Where to add deprecation comment

  **WHY Each Reference Matters**:
  - `ToolCallRow.tsx`: Add deprecation notice for future maintainers

  **Acceptance Criteria**:

  **Automated Verification**:
  ```bash
  # Full client test suite passes
  cd /Users/tomas/Workspace/ocwatch/src/client && bun run test
  # Assert: Exit code 0
  
  # TypeScript compiles
  cd /Users/tomas/Workspace/ocwatch && bun run tsc -b
  # Assert: Exit code 0
  
  # Deprecation comment exists
  grep -q "@deprecated" /Users/tomas/Workspace/ocwatch/src/client/src/components/ToolCallRow.tsx && echo "DEPRECATED_MARKED"
  # Assert: Output contains "DEPRECATED_MARKED"
  ```

  **Visual Verification** (final check via browser):
  ```
  1. Navigate to http://localhost:5173
  2. Full walkthrough of Live Activity panel
  3. Assert: All sessions render correctly
  4. Assert: Hierarchy preserved with connectors
  5. Assert: Agent badges have enhanced styling
  6. Assert: No expansion behavior anywhere
  7. Screenshot: .sisyphus/evidence/task-5-final-verification.png
  ```

  **Commit**: YES
  - Message: `chore: mark ToolCallRow as deprecated, final verification`
  - Files: `src/client/src/components/ToolCallRow.tsx`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(ui): add AgentBadge component with enhanced gradient styling` | AgentBadge.tsx | tsc --noEmit |
| 2 | `feat(ui): add badge glow animation for working status` | animations.css | grep check |
| 3 | `refactor(ui): simplify LiveActivity to single-line rows, remove expansion` | LiveActivity.tsx | tsc --noEmit |
| 4 | `test(ui): update LiveActivity tests for simplified non-expandable rows` | LiveActivity.test.tsx | bun run test |
| 5 | `chore: mark ToolCallRow as deprecated, final verification` | ToolCallRow.tsx | full test suite |

---

## Success Criteria

### Verification Commands
```bash
# TypeScript compiles
cd /Users/tomas/Workspace/ocwatch && bun run tsc -b
# Expected: Exit code 0

# Client tests pass
cd /Users/tomas/Workspace/ocwatch/src/client && bun run test
# Expected: All tests pass

# Dev server runs
cd /Users/tomas/Workspace/ocwatch && bun run dev
# Expected: Server starts, UI accessible at localhost:5173
```

### Final Checklist
- [ ] LiveActivity shows sessions in simplified flat rows (hierarchy preserved)
- [ ] NO expandable tool call lists anywhere
- [ ] Agent badges have gradient background + glow effects
- [ ] All info preserved: status, action, tool, time, model, tokens
- [ ] All tests pass
- [ ] TypeScript compiles without errors
- [ ] ToolCallRow.tsx marked as deprecated
