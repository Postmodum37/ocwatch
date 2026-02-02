# SessionStats Compact Redesign

## TL;DR

> **Quick Summary**: Fix server-side model sorting and redesign SessionStats from vertical card to compact inline header with dropdown for model details.
> 
> **Deliverables**:
> - Server: Sort modelBreakdown by tokens descending
> - Client: Compact inline `⚡ 445k | $0.00 | 5 models ▼` with dropdown
> - Tests: Update 7 existing tests for new layout
> 
> **Estimated Effort**: Medium (3-4 hours)
> **Parallel Execution**: YES - 2 waves (server fix || client redesign, then tests)
> **Critical Path**: Task 1 (server) + Task 2 (client) can run in parallel → Task 3 (tests)

---

## Context

### Original Request
User showed screenshot where:
1. Session Stats panel takes massive vertical space in header
2. Live Activity section is squeezed/too small
3. Model breakdown list is NOT sorted by token count
4. OCWatch branding area has empty space

User requested: "Fix this using ultrawork and coming up with the better design"

### Interview Summary
**Key Discussions**:
- Layout change: Vertical card → Horizontal inline with dropdown
- Sorting bug: Server returns unsorted modelBreakdown array
- Pattern reference: Follow SessionList.tsx dropdown pattern

**Research Findings**:
- `aggregateSessionStats()` at line 127 returns unsorted `Array.from(modelTokensMap.values())`
- SessionList.tsx uses `useState(isDropdownOpen)` + `absolute top-full` positioning
- AgentBadge shows inline pattern: `inline-flex items-center px-2.5 py-1`
- Current SessionStats has 7 tests in `SessionStats.test.tsx`

### Gap Analysis (Metis Review)
**Identified Gaps** (addressed):
- Dropdown interaction: Click "N models" to open, click outside/anywhere to close
- Edge case (0 models): Show "No model data" in dropdown
- Edge case (1 model): Still show dropdown for consistency
- Long model names: Truncate with `max-w-[250px]` in dropdown, full name on hover
- Sorting: Descending by tokens (highest first)
- Click-outside: Added via `useEffect` with document click listener (following existing patterns)

---

## Work Objectives

### Core Objective
Transform SessionStats from a tall vertical card into a compact inline header element while fixing the model breakdown sorting bug.

### Concrete Deliverables
- `src/server/index.ts`: Line 127 sorted by tokens descending
- `src/client/src/components/SessionStats.tsx`: Compact inline layout with dropdown
- `src/client/src/components/__tests__/SessionStats.test.tsx`: Updated tests

### Definition of Done
- [ ] Server returns modelBreakdown sorted by tokens DESC
- [ ] SessionStats displays as single-line: `⚡ {tokens} | ${cost} | N models ▼`
- [ ] Clicking "N models" opens dropdown showing sorted model list
- [ ] All 7+ tests pass with new structure
- [ ] `bun test` passes
- [ ] `cd src/client && bun run test` passes

### Must Have
- Tokens formatted with `k` suffix (e.g., 445k for 445,071)
- Cost formatted as `$X.XX` or `—` if undefined
- Model count clickable to reveal dropdown
- Dropdown shows model name + token count per row
- Models sorted by tokens descending
- Empty state preserved ("No stats available")

### Must NOT Have (Guardrails)
- DO NOT change SessionStats type interface (props remain `stats?: SessionStatsType | null`)
- DO NOT add state to AppContext (dropdown state is local to component)
- DO NOT use `position: fixed` for dropdown (use `absolute` relative to parent)
- DO NOT sort on client side (sorting happens server-side only)
- DO NOT add keyboard navigation (out of scope for v1)
- DO NOT change header layout in App.tsx
- DO NOT remove data-testid attributes
- DO NOT add external dependencies (use existing lucide-react icons)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest with React Testing Library)
- **User wants tests**: YES - existing tests must be updated
- **Framework**: Vitest (bun run test in src/client)

### Automated Verification

**Server Changes**: Test via manual curl or integration test
```bash
# Verify sorting in poll response
curl -s http://localhost:50234/api/poll | jq '.sessionStats.modelBreakdown | .[0].tokens >= .[1].tokens'
# Expected: true (first model has highest tokens)
```

**Client Changes**: Vitest with React Testing Library
```bash
cd src/client && bun run test SessionStats
# Expected: All tests pass
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Server fix (sorting)
└── Task 2: Client redesign (SessionStats.tsx)

Wave 2 (After Wave 1):
└── Task 3: Test updates (SessionStats.test.tsx)

Critical Path: Tasks 1,2 (parallel) → Task 3
Parallel Speedup: ~40% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3 | 2 |
| 2 | None | 3 | 1 |
| 3 | 1, 2 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | dispatch parallel, category='quick' |
| 2 | 3 | sequential after Wave 1 |

---

## TODOs

- [ ] 1. Fix Server-Side Model Sorting

  **What to do**:
  - Open `src/server/index.ts`
  - Find `aggregateSessionStats()` function (around line 91-134)
  - At line 127, change:
    ```typescript
    // FROM:
    const modelBreakdown = Array.from(modelTokensMap.values());
    
    // TO:
    const modelBreakdown = Array.from(modelTokensMap.values())
      .sort((a, b) => b.tokens - a.tokens);
    ```
  - This ensures models with highest token counts appear first

  **Must NOT do**:
  - DO NOT change the return type of `aggregateSessionStats()`
  - DO NOT add any client-side sorting logic
  - DO NOT modify any other functions in the file

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-line change in known location
  - **Skills**: []
    - No special skills needed for this simple edit
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed, single commit at end

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3 (tests depend on sorted data)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/server/index.ts:91-134` - `aggregateSessionStats()` function that builds model breakdown

  **API/Type References**:
  - `src/shared/types/index.ts:SessionStats` - Type definition showing modelBreakdown array structure

  **WHY Each Reference Matters**:
  - The `aggregateSessionStats()` function is where modelBreakdown array is created from the Map
  - Line 127 specifically is where `Array.from()` converts Map values without sorting

  **Acceptance Criteria**:

  **Automated Verification** (using Bash curl):
  ```bash
  # Start server if not running, then verify sort order
  curl -s http://localhost:50234/api/poll?sessionId=any | jq -e '
    .sessionStats.modelBreakdown as $m | 
    if ($m | length) < 2 then true 
    else ($m[0].tokens >= $m[1].tokens) end
  '
  # Assert: Returns true (exit code 0) - first model has >= tokens than second
  ```

  **Evidence to Capture:**
  - [ ] JSON response showing modelBreakdown[0].tokens >= modelBreakdown[1].tokens

  **Commit**: YES (group with Task 2)
  - Message: `fix(server): sort modelBreakdown by tokens descending`
  - Files: `src/server/index.ts`
  - Pre-commit: N/A (server has no test command)

---

- [ ] 2. Redesign SessionStats Component to Compact Inline

  **What to do**:
  
  1. **Add imports and state**:
     ```typescript
     import { useState, useEffect, useRef } from 'react';
     import { Zap, ChevronDown } from 'lucide-react';
     ```
  
  2. **Add token formatting helper** (inside component or before):
     ```typescript
     const formatTokens = (tokens: number): string => {
       if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
       if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}k`;
       return tokens.toString();
     };
     ```
  
  3. **Add dropdown state and click-outside handler**:
     ```typescript
     const [isOpen, setIsOpen] = useState(false);
     const dropdownRef = useRef<HTMLDivElement>(null);
     
     useEffect(() => {
       const handleClickOutside = (event: MouseEvent) => {
         if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
           setIsOpen(false);
         }
       };
       if (isOpen) {
         document.addEventListener('mousedown', handleClickOutside);
       }
       return () => document.removeEventListener('mousedown', handleClickOutside);
     }, [isOpen]);
     ```
  
  4. **Replace JSX** with compact inline layout:
     - Empty state: Keep existing but make more compact
     - Stats display: Single horizontal line with | separators
     - Model count: Clickable with ChevronDown icon
     - Dropdown: Absolute positioned below trigger, shows sorted models
  
  5. **Target Layout**:
     ```
     ⚡ 445k | $0.00 | 5 models ▼
                     └── dropdown on click
     ```

  **Must NOT do**:
  - DO NOT change component props interface
  - DO NOT remove data-testid attributes
  - DO NOT use position: fixed for dropdown
  - DO NOT add sorting logic (server already sorts)
  - DO NOT remove empty state handling

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single component rewrite with clear pattern to follow
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Needed for crafting clean, compact UI layout
  - **Skills Evaluated but Omitted**:
    - `design-principles`: Overkill for component-level work
    - `playwright`: Not needed for component implementation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3 (tests depend on new component structure)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/client/src/components/SessionList.tsx:34-100` - Dropdown pattern with `useState(isDropdownOpen)`, `absolute top-full` positioning, click handler
  - `src/client/src/components/AgentBadge.tsx:14-32` - Inline badge styling `inline-flex items-center px-2.5 py-1`
  - `src/client/src/App.tsx:71-95` - Header context where SessionStats lives

  **API/Type References**:
  - `src/shared/types/index.ts:SessionStats` - Props type definition
  - `src/shared/types/index.ts:ModelTokens` - Model breakdown item type

  **Test References**:
  - `src/client/src/components/__tests__/SessionStats.test.tsx` - Existing test structure to preserve data-testid

  **WHY Each Reference Matters**:
  - SessionList.tsx shows exact dropdown pattern this project uses (useState, absolute positioning)
  - AgentBadge shows inline styling patterns for compact header elements
  - Test file shows which data-testid attributes must be preserved

  **Acceptance Criteria**:

  **Automated Verification (using playwright skill):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173 (Vite dev server)
  2. Wait for: selector "[data-testid='session-stats']" to be visible
  3. Assert: SessionStats takes single line height (not tall card)
  4. Assert: Text contains token count with 'k' or 'M' suffix
  5. Assert: Text contains '$' for cost
  6. Click: the "models" dropdown trigger
  7. Wait for: dropdown menu to appear
  8. Assert: Dropdown contains model names
  9. Assert: First model in dropdown has highest token count
  10. Screenshot: .sisyphus/evidence/task-2-compact-stats.png
  ```

  **Manual fallback verification:**
  ```bash
  # Type check passes
  cd src/client && bun run tsc --noEmit
  # Expected: No errors
  ```

  **Evidence to Capture:**
  - [ ] Screenshot of compact SessionStats in header
  - [ ] Screenshot of dropdown open with sorted models
  - [ ] tsc --noEmit passes

  **Commit**: YES (group with Task 1)
  - Message: `feat(client): redesign SessionStats as compact inline with dropdown`
  - Files: `src/client/src/components/SessionStats.tsx`
  - Pre-commit: `cd src/client && bun run tsc --noEmit`

---

- [ ] 3. Update SessionStats Tests

  **What to do**:
  
  1. **Review existing tests** (7 tests):
     - `renders total tokens formatted with commas` - UPDATE: Check for 'k'/'M' suffix instead
     - `renders cost formatted with $ and 2 decimals` - KEEP: Still shows cost
     - `renders "—" when cost is undefined` - KEEP: Behavior unchanged
     - `renders model breakdown list with model names and token counts` - UPDATE: Test dropdown content
     - `renders empty/placeholder state when stats prop is null` - KEEP: Behavior unchanged
     - `renders empty/placeholder state when stats prop is undefined` - KEEP: Behavior unchanged
     - `handles empty modelBreakdown array gracefully` - UPDATE: Test dropdown empty state
  
  2. **Add new tests**:
     - `opens dropdown when clicking model count trigger`
     - `closes dropdown when clicking outside`
     - `shows model count in trigger (e.g., "5 models")`
  
  3. **Update test patterns**:
     - Use `fireEvent.click` to test dropdown interaction
     - Use `screen.queryByTestId` for dropdown visibility checks
     - Ensure data-testid consistency with new component

  **Must NOT do**:
  - DO NOT delete tests without replacement
  - DO NOT change test file location
  - DO NOT add snapshot tests
  - DO NOT test sorting (server responsibility)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Test updates following existing patterns
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not needed for test code

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 1, 2 (needs both server sort and new component)

  **References**:

  **Pattern References**:
  - `src/client/src/components/__tests__/SessionList.test.tsx:104-208` - Dropdown testing patterns with `fireEvent.click`, `getByTestId('project-dropdown-button')`
  - `src/client/src/components/__tests__/SessionStats.test.tsx` - Existing test structure to modify

  **API/Type References**:
  - `@testing-library/react` - `render`, `screen`, `fireEvent`
  - `vitest` - `describe`, `it`, `expect`

  **Test References**:
  - `src/client/src/components/__tests__/SessionList.test.tsx:118-132` - "opens dropdown when button is clicked" test pattern

  **WHY Each Reference Matters**:
  - SessionList.test.tsx shows exactly how this project tests dropdown open/close behavior
  - Existing SessionStats.test.tsx shows mock data structure to reuse

  **Acceptance Criteria**:

  **Automated Verification (using Bash bun):**
  ```bash
  # Run tests
  cd src/client && bun run test SessionStats
  # Assert: All tests pass (exit code 0)
  # Assert: Output shows "✓" for each test
  ```

  **Evidence to Capture:**
  - [ ] Terminal output showing all SessionStats tests pass
  - [ ] Test count matches or exceeds original (7+ tests)

  **Commit**: YES
  - Message: `test(client): update SessionStats tests for compact layout`
  - Files: `src/client/src/components/__tests__/SessionStats.test.tsx`
  - Pre-commit: `cd src/client && bun run test SessionStats`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 + 2 | `fix(server): sort modelBreakdown by tokens descending` | src/server/index.ts | curl test |
| 1 + 2 | `feat(client): redesign SessionStats as compact inline with dropdown` | src/client/src/components/SessionStats.tsx | tsc --noEmit |
| 3 | `test(client): update SessionStats tests for compact layout` | src/client/src/components/__tests__/SessionStats.test.tsx | bun run test |

---

## Success Criteria

### Verification Commands
```bash
# Server sorting
curl -s http://localhost:50234/api/poll | jq '.sessionStats.modelBreakdown[0:2] | .[0].tokens >= .[1].tokens'
# Expected: true

# Client type check
cd src/client && bun run tsc --noEmit
# Expected: no errors

# Client tests
cd src/client && bun run test SessionStats
# Expected: all tests pass
```

### Final Checklist
- [ ] Model breakdown sorted by tokens descending (highest first)
- [ ] SessionStats displays as compact single line in header
- [ ] Dropdown shows model details on click
- [ ] "No stats available" empty state preserved
- [ ] All original test behaviors preserved (7 tests)
- [ ] New dropdown interaction tests added
- [ ] No TypeScript errors
- [ ] No console errors in browser
