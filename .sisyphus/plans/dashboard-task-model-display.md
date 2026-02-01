# Dashboard Task/Model Display Enhancement

## TL;DR

> **Quick Summary**: Improve OCWatch dashboard to clearly show what TASK each agent is working on, which MODEL (provider/model) it's using, with color-coded agent badges and distinct root vs child session styling.
> 
> **Deliverables**:
> - Fixed `providerID` parsing in message parser
> - `providerID` added to `SessionMetadata` type
> - `/api/poll` enriched with `providerID`
> - Redesigned AgentTree nodes (72px height, agent colors, "TASK:" prefix, model display)
> - Root session distinction (thicker border)
> 
> **Estimated Effort**: Medium (~2-3 hours)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 3 → Task 4

---

## Context

### Original Request
User wants to see:
1. What TASK each spawned agent is doing (session title IS the task)
2. What MODEL that agent uses (provider/model format)
3. Agent name prominently displayed with distinct colors
4. Clear visual hierarchy between root and child sessions

### Interview Summary
**Key Discussions**:
- Task display: Add "TASK:" prefix for child sessions (UI-only)
- Model format: Always show full path `{providerID}/{modelID}`
- Node size: Increase from 50px to 72px height
- Agent colors: sisyphus=blue, prometheus=purple, explore=green, fallback=gray
- Root vs child: Root sessions get thicker border (2px vs 1px)

**Research Findings**:
- `providerID` already exists in `MessageMeta` type but not `SessionMetadata`
- Message parser bug: only reads `json.providerID`, not `json.model?.providerID`
- `/api/poll` enriches with agent/modelID but NOT providerID
- Current node size: 250x50px

### Metis Review
**Identified Gaps** (addressed):
- TASK prefix scope → UI-only transformation in AgentTree
- Exact node height → 72px (clean number)
- Unknown agent fallback color → gray (#6b7280)
- Root session styling → 2px border (vs 1px for child)
- providerID null handling → show just modelID

---

## Work Objectives

### Core Objective
Improve the AgentTree visualization to clearly display agent tasks, models, and hierarchy.

### Concrete Deliverables
- `src/shared/types/index.ts` - Add `providerID` to `SessionMetadata`
- `src/server/storage/messageParser.ts` - Fix nested providerID parsing
- `src/server/index.ts` - Include providerID in /api/poll enrichment
- `src/client/src/components/AgentTree.tsx` - Redesigned node rendering

### Definition of Done
- [x] AgentTree nodes show "TASK: {title}" for child sessions
- [x] Model displays as "provider/model" (e.g., "anthropic/claude-sonnet-4")
- [x] Agent badges have distinct colors per agent type
- [x] Root sessions have visually distinct styling (thicker border)
- [x] Node height is 72px with proper layout
- [x] All existing tests pass: `bun test` and `cd src/client && bun run test`

### Must Have
- providerID in API response for sessions
- Color-coded agent badges (sisyphus=blue, prometheus=purple, explore=green)
- "TASK:" prefix for child session titles in UI
- Full model path display (provider/model)
- Root vs child visual distinction

### Must NOT Have (Guardrails)
- Do NOT modify Claude Code storage files (read-only)
- Do NOT add filtering/search UI for agents
- Do NOT add agent color customization UI
- Do NOT change polling interval (2s is locked)
- Do NOT add new dependencies
- Do NOT modify other API endpoints (only /api/poll for now)
- Do NOT persist "TASK:" prefix to storage (UI-only)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test + vitest)
- **User wants tests**: NO - Manual verification via browser
- **Framework**: bun test (server), vitest (client)

### Automated Verification

Each task includes verification via Playwright browser automation or terminal commands.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Fix providerID parsing in messageParser.ts
└── Task 2: Add providerID to SessionMetadata type

Wave 2 (After Wave 1):
├── Task 3: Include providerID in /api/poll enrichment
└── Task 4: Redesign AgentTree node rendering

Critical Path: Task 1 → Task 3 → Task 4
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3 | 2 |
| 2 | None | 3, 4 | 1 |
| 3 | 1, 2 | 4 | None |
| 4 | 2, 3 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | `quick` category, parallel background tasks |
| 2 | 3, 4 | Sequential after Wave 1 completes |

---

## TODOs

- [x] 1. Fix providerID parsing in message parser

  **What to do**:
  - Open `src/server/storage/messageParser.ts`
  - Line 70-71: Update providerID extraction to include nested fallback
  - Change from: `providerID: json.providerID`
  - Change to: `providerID: json.providerID || json.model?.providerID`
  
  **Must NOT do**:
  - Do NOT change the return type (MessageMeta already has providerID)
  - Do NOT modify other fields

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-line fix in one file
  - **Skills**: None needed
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed for this task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/server/storage/messageParser.ts:70-71` - Current providerID parsing (line 70: modelID, line 71: providerID)
  - `src/server/storage/messageParser.ts:24-28` - MessageJSON interface showing nested model.providerID structure

  **API/Type References**:
  - `src/shared/types/index.ts:31` - MessageMeta.providerID field definition

  **Test References**:
  - `src/server/storage/__tests__/parsers.test.ts:170` - Test with providerID field

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun test src/server/storage/__tests__/parsers.test.ts
  # Assert: All tests pass
  # Assert: Exit code 0
  ```

  **Evidence to Capture:**
  - [x] Terminal output from test command

  **Commit**: YES
  - Message: `fix(parser): extract providerID from nested model object`
  - Files: `src/server/storage/messageParser.ts`
  - Pre-commit: `bun test src/server/storage/__tests__/parsers.test.ts`

---

- [x] 2. Add providerID to SessionMetadata type

  **What to do**:
  - Open `src/shared/types/index.ts`
  - Add `providerID?: string | null;` field to SessionMetadata interface (after modelID line 16)

  **Must NOT do**:
  - Do NOT modify other types
  - Do NOT remove existing fields

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-line addition to type file
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/shared/types/index.ts:15-16` - Existing agent and modelID fields in SessionMetadata

  **API/Type References**:
  - `src/shared/types/index.ts:30-31` - MessageMeta already has providerID (follow same pattern)

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run tsc -b --noEmit
  # Assert: No type errors
  # Assert: Exit code 0
  ```

  **Evidence to Capture:**
  - [x] Terminal output showing no type errors

  **Commit**: YES (group with Task 1)
  - Message: `feat(types): add providerID to SessionMetadata`
  - Files: `src/shared/types/index.ts`
  - Pre-commit: `bun run tsc -b --noEmit`

---

- [x] 3. Include providerID in /api/poll enrichment

  **What to do**:
  - Open `src/server/index.ts`
  - Find the session enrichment block (lines 326-335)
  - Add `providerID: firstAssistantMsg?.providerID || null` to the returned object

  **Must NOT do**:
  - Do NOT modify other API endpoints (only /api/poll)
  - Do NOT change the PollResponse interface structure
  - Do NOT change ETag generation logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple field addition in one location
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: Task 4
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/server/index.ts:326-335` - Current session enrichment with agent and modelID
  - `src/server/index.ts:329-333` - Pattern for adding fields to enriched session

  **API/Type References**:
  - `src/server/storage/messageParser.ts:71` - Where providerID comes from (first assistant message)
  - `src/shared/types/index.ts:31` - MessageMeta.providerID definition

  **Test References**:
  - `src/server/__tests__/routes.test.ts` - API route tests (if exists)

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  bun run src/server/index.ts &
  sleep 2
  curl -s http://localhost:50234/api/poll | jq '.sessions[0] | {id, agent, modelID, providerID}'
  # Assert: Response includes providerID field (may be null if no data)
  # Assert: providerID is present in the JSON structure
  pkill -f "bun run src/server"
  ```

  **Evidence to Capture:**
  - [x] Terminal output showing providerID in API response

  **Commit**: YES
  - Message: `feat(api): include providerID in poll response`
  - Files: `src/server/index.ts`
  - Pre-commit: `bun test`

---

- [x] 4. Redesign AgentTree node rendering

  **What to do**:
  - Open `src/client/src/components/AgentTree.tsx`
  - Update constants: `nodeHeight = 72` (line 24)
  - Create agent color mapping function:
    ```typescript
    const getAgentColor = (agent: string | null | undefined): string => {
      switch (agent) {
        case 'sisyphus':
        case 'sisyphus-junior':
          return '#3b82f6'; // blue
        case 'prometheus':
          return '#a855f7'; // purple
        case 'explore':
        case 'librarian':
          return '#22c55e'; // green
        default:
          return '#6b7280'; // gray fallback
      }
    };
    ```
  - Update node label JSX (lines 73-92) to:
    - Show "TASK: {title}" for child sessions (when `session.parentID` exists)
    - Show just "{title}" for root sessions
    - Display full model path: `{providerID}/{modelID}` or just `{modelID}` if no providerID
    - Style agent badge with `getAgentColor()` function
    - Increase font size for agent badge
  - Update node styling (lines 97-105) to:
    - Use 2px border for root sessions (`!session.parentID`)
    - Use 1px border for child sessions (`session.parentID` exists)

  **Must NOT do**:
  - Do NOT add new dependencies
  - Do NOT change React Flow configuration
  - Do NOT modify dagre layout algorithm
  - Do NOT change node width (keep 250px)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with specific styling requirements
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Needed for proper styling implementation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after Task 3)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `src/client/src/components/AgentTree.tsx:23-24` - Node dimension constants (nodeWidth, nodeHeight)
  - `src/client/src/components/AgentTree.tsx:73-92` - Current node label JSX structure
  - `src/client/src/components/AgentTree.tsx:97-105` - Current node styling object

  **Type References**:
  - `src/shared/types/index.ts:9-19` - SessionMetadata interface (agent, modelID, providerID, parentID)

  **Style References**:
  - Dark theme colors from AGENTS.md: bg=#0d1117, surface=#161b22, accent=#58a6ff

  **Agent Color Specifications**:
  - sisyphus/sisyphus-junior: `#3b82f6` (Tailwind blue-500)
  - prometheus: `#a855f7` (Tailwind purple-500)
  - explore/librarian: `#22c55e` (Tailwind green-500)
  - unknown/null: `#6b7280` (Tailwind gray-500)

  **Acceptance Criteria**:

  ```
  # Agent executes via playwright browser automation:
  1. Start dev server: cd src/client && bun run dev (background)
  2. Start backend: bun run src/server/index.ts (background)
  3. Navigate to: http://localhost:3000
  4. Wait for: React Flow canvas to be visible
  5. Assert: Node height appears taller than before (visual check via element inspection)
  6. If sessions with children exist:
     - Assert: Child session nodes show "TASK:" prefix in title
     - Assert: Root session nodes do NOT show "TASK:" prefix
  7. If sessions with agent data exist:
     - Assert: Agent badge has colored background (not gray #374151)
  8. Screenshot: .sisyphus/evidence/task-4-agent-tree.png
  9. Cleanup: kill background processes
  ```

  **Evidence to Capture:**
  - [x] Screenshot of AgentTree with redesigned nodes
  - [x] Element inspection showing 72px node height

  **Commit**: YES
  - Message: `feat(ui): redesign AgentTree nodes with task/model/agent display`
  - Files: `src/client/src/components/AgentTree.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1+2 | `fix(parser): extract providerID from nested model object` | messageParser.ts, types/index.ts | bun test |
| 3 | `feat(api): include providerID in poll response` | server/index.ts | bun test |
| 4 | `feat(ui): redesign AgentTree nodes with task/model/agent display` | AgentTree.tsx | cd src/client && bun run test |

---

## Success Criteria

### Verification Commands
```bash
# Backend tests pass
bun test
# Expected: All tests pass

# Client tests pass
cd src/client && bun run test
# Expected: All tests pass

# Type check passes
bun run tsc -b --noEmit
# Expected: No errors

# API returns providerID
curl -s http://localhost:50234/api/poll | jq '.sessions[0].providerID'
# Expected: String or null (not undefined/missing key)
```

### Final Checklist
- [x] All "Must Have" present:
  - [x] providerID in API response
  - [x] Color-coded agent badges
  - [x] "TASK:" prefix for child sessions
  - [x] Full model path display
  - [x] Root vs child visual distinction
- [x] All "Must NOT Have" absent:
  - [x] No new dependencies added
  - [x] No filtering UI added
  - [x] No storage modifications
- [x] All tests pass (bun test + cd src/client && bun run test)
