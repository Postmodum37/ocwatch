# Display Agents and Models in OCWatch Dashboard

## TL;DR

> **Quick Summary**: Fix message parsing path bug and update UI to show which agents (explore, prometheus, etc.) and models (claude-haiku-4-5, claude-sonnet-4, etc.) are running for each session.
> 
> **Deliverables**:
> - Fixed messageParser.ts to read from correct path
> - `/api/poll` response includes agent/model per session
> - SessionList shows agent badge for each session
> - AgentTree nodes display agent/model info
> 
> **Estimated Effort**: Medium (4-5 tasks, ~2 hours)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (parser fix) → Task 2 (API) → Tasks 3,4 (UI parallel)

---

## Context

### Original Request
User wants to see which agents and which models are being called for each session in the OCWatch dashboard. The screenshot shows sessions listed but no agent/model information displayed.

### Interview Summary
**Key Discussions**:
- This is a straightforward bug fix + feature completion
- Data exists in storage, just not being parsed/displayed correctly

**Research Findings**:
- Message storage path is `~/.local/share/opencode/storage/message/{sessionID}/{messageID}.json` (confirmed via filesystem inspection)
- Messages have `agent` field and either flat `modelID` or nested `model.modelID`
- The TreeNode type already has agent/model fields defined but they're never populated
- `/api/poll` endpoint exists and returns sessions but lacks agent/model data

### Metis Review
**Identified Gaps** (addressed):
- Path validation: Confirmed storage is at `opencode/` not `Claude/` via bash inspection
- Edge cases: Sessions with 0 messages should show "Unknown"
- JSON structure: Need to handle both nested and flat model fields
- Agent selection: Use first assistant message's agent (skip user messages)
- Long names: Add CSS truncation for agent names > 30 chars

---

## Work Objectives

### Core Objective
Show agent name and model ID for each session in the dashboard UI, both in the session list sidebar and the agent tree visualization.

### Concrete Deliverables
- `src/server/storage/messageParser.ts` - Fixed path construction, handles both JSON formats
- `src/server/index.ts` - `/api/poll` includes `agent` and `modelID` per session
- `src/client/src/components/SessionList.tsx` - Agent badge displayed
- `src/client/src/components/AgentTree.tsx` - Agent/model in tree nodes
- `src/shared/types/index.ts` - Extended session type with agent/model

### Definition of Done
- [x] `/api/sessions/:id/messages` returns > 0 messages for active sessions
- [x] `/api/poll` response has `agent` and `modelID` fields on each session object
- [x] SessionList visually displays agent name for sessions with activity
- [x] AgentTree nodes display agent and model info
- [x] Sessions with no messages show "Unknown" agent/model gracefully

### Must Have
- Fix messageParser path to use `message/{sessionID}/{messageID}.json`
- Handle both `modelID` and `model.modelID` JSON structures
- Show agent name in SessionList
- Show agent/model in AgentTree nodes

### Must NOT Have (Guardrails)
- Agent filtering/search UI (ANTI-PATTERN per AGENTS.md)
- Token/cost display (ANTI-PATTERN per AGENTS.md)
- Agent icons or avatars (scope creep)
- New API endpoints (extend existing `/api/poll`)
- Changes to polling interval (stay at 2 seconds)
- Parsing ALL messages per session (only find first assistant message)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (bun test exists)
- **User wants tests**: Manual verification only for this bugfix
- **Framework**: bun test (existing)

### Automated Verification

Each task includes curl/playwright verification the executor can run directly.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Fix messageParser path construction

Wave 2 (After Wave 1):
├── Task 2: Add agent/model to /api/poll response
└── (depends on Task 1 for messages to be found)

Wave 3 (After Wave 2):
├── Task 3: Update SessionList UI (can parallel with Task 4)
└── Task 4: Update AgentTree UI (can parallel with Task 3)

Critical Path: Task 1 → Task 2 → Task 3
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3, 4 | None |
| 2 | 1 | 3, 4 | None |
| 3 | 2 | None | 4 |
| 4 | 2 | None | 3 |

---

## TODOs

- [x] 1. Fix messageParser.ts path construction and JSON handling

  **What to do**:
  - Change `listMessages()` to read from `message/{sessionID}/{messageID}.json` instead of `message/{messageID}.json`
  - Update the path construction in `getMessage()` as well
  - Handle both JSON structures for model: check `json.modelID` first, fall back to `json.model?.modelID`
  - Add helper function `getFirstAssistantMessage(sessionID)` that returns the first message with `role === "assistant"`

  **Must NOT do**:
  - Do not parse all messages for a session - stop after finding first assistant message
  - Do not add new dependencies or libraries
  - Do not change the MessageMeta type definition

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file change with clear fix, no architectural decisions
  - **Skills**: []
    - No special skills needed - straightforward TypeScript fix

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (alone)
  - **Blocks**: Tasks 2, 3, 4
  - **Blocked By**: None (can start immediately)

  **References**:
  - `src/server/storage/messageParser.ts:108-136` - Current `listMessages()` function that has the wrong path
  - `src/server/storage/messageParser.ts:86-100` - Current `getMessage()` function that needs path fix
  - Actual storage structure: `~/.local/share/opencode/storage/message/{sessionID}/{messageID}.json`
  - Sample message JSON (assistant role): Has flat `modelID` and `providerID` fields
  - Sample message JSON (user role): Has nested `model.modelID` and `model.providerID`

  **Acceptance Criteria**:

  **Automated Verification (curl):**
  ```bash
  # After fix, messages should be found
  curl -s "http://localhost:50234/api/sessions/$(curl -s http://localhost:50234/api/poll | jq -r '.sessions[0].id')/messages" | jq 'length'
  # Assert: Output > 0 (messages found)
  
  # First message should have agent and modelID
  curl -s "http://localhost:50234/api/sessions/$(curl -s http://localhost:50234/api/poll | jq -r '.sessions[0].id')/messages" | jq '.[0] | {agent, modelID}'
  # Assert: Both fields present (may be null for user messages, but should exist)
  ```

  **Commit**: YES
  - Message: `fix(parser): correct message storage path to include sessionID`
  - Files: `src/server/storage/messageParser.ts`
  - Pre-commit: `bun test src/server/storage/__tests__/parsers.test.ts`

---

- [x] 2. Add agent/model fields to /api/poll response

  **What to do**:
  - Modify the `/api/poll` handler in `src/server/index.ts` to fetch first assistant message for each session
  - Add `agent` and `modelID` fields to each session object in the response
  - Use the new `getFirstAssistantMessage()` helper from Task 1
  - Handle edge case: if no assistant message found, set agent/modelID to `null`

  **Must NOT do**:
  - Do not add new endpoints - extend the existing `/api/poll`
  - Do not fetch ALL messages - only the first assistant message
  - Do not slow down the poll response > 100ms (it's polled every 2s)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple API response extension, follows existing patterns
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (after Task 1)
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: Task 1

  **References**:
  - `src/server/index.ts:296-370` - Current `/api/poll` handler
  - `src/server/index.ts:159-180` - Pattern for adding fields to session response (see `sessionsWithActivity`)
  - `src/shared/types/index.ts:7-17` - SessionMetadata type (may need extension or use extended type in response)

  **Acceptance Criteria**:

  **Automated Verification (curl):**
  ```bash
  # Poll response should include agent and modelID for each session
  curl -s http://localhost:50234/api/poll | jq '.sessions[0] | {id, agent, modelID}'
  # Assert: agent field present (may be null but field must exist)
  # Assert: modelID field present (may be null but field must exist)
  
  # For a session with activity, agent should be non-null
  curl -s http://localhost:50234/api/poll | jq '.sessions | map(select(.agent != null)) | length'
  # Assert: > 0 (at least some sessions have agents)
  ```

  **Commit**: YES
  - Message: `feat(api): add agent and modelID to poll response`
  - Files: `src/server/index.ts`
  - Pre-commit: `bun test`

---

- [x] 3. Update SessionList to display agent badge

  **What to do**:
  - Add agent name display to each session item in `SessionList.tsx`
  - Show agent as a small badge/label below the session title
  - If agent is null/undefined, show "Unknown" or skip showing the badge
  - Add CSS truncation for agent names longer than 20 characters
  - Update the SessionMetadata prop type to include optional agent/modelID fields

  **Must NOT do**:
  - Do not add agent filtering functionality
  - Do not add icons or avatars for different agents
  - Do not change the overall layout structure significantly

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component change with styling considerations
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Need good visual design for the badge

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 4)
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `src/client/src/components/SessionList.tsx:108-142` - Session item rendering
  - `src/client/src/components/SessionList.tsx:133-138` - Existing badge pattern (status indicator)
  - Tailwind classes used: `text-xs`, `text-text-secondary`, `truncate`
  - Design pattern: Follow existing dark theme colors from AGENTS.md

  **Acceptance Criteria**:

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:50234
  2. Wait for: selector "[data-testid='session-list']" to be visible
  3. Assert: At least one session item contains text matching pattern "explore|prometheus|oracle|build|sisyphus" (common agent names)
  4. Screenshot: .sisyphus/evidence/task-3-session-agent-badge.png
  ```

  **Visual Check Pattern:**
  - Session items should show: Title, timestamp, AND agent name
  - Agent name should be styled as a subtle badge (smaller text, secondary color)
  - Long agent names truncated with ellipsis

  **Commit**: YES
  - Message: `feat(ui): display agent name in session list`
  - Files: `src/client/src/components/SessionList.tsx`
  - Pre-commit: `cd src/client && bun run lint`

---

- [x] 4. Update AgentTree to display agent/model in nodes

  **What to do**:
  - Update the tree endpoint usage to include agent/model data in nodes
  - Modify node rendering in `AgentTree.tsx` to display agent and model below the title
  - Format model nicely (e.g., "claude-haiku-4-5" → "Haiku 4.5" or just show raw)
  - Handle null values gracefully (show "Unknown" or skip)

  **Must NOT do**:
  - Do not change the tree layout algorithm (dagre)
  - Do not add node icons based on agent type
  - Do not make nodes larger than current 250x50 size

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with React Flow node rendering
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Need good visual design for node content

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 3)
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `src/client/src/components/AgentTree.tsx:60-98` - Node creation and data setup
  - `src/client/src/components/AgentTree.tsx:70-86` - Node styling object
  - `src/server/index.ts:15-23` - TreeNode interface with agent/model fields
  - `src/server/index.ts:55-115` - `buildSessionTree` function that populates node data

  **Acceptance Criteria**:

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:50234
  2. Wait for: selector "[data-testid='agent-tree']" to be visible
  3. Click on: First session in session list to ensure tree loads
  4. Wait for: React Flow nodes to render (selector ".react-flow__node")
  5. Assert: At least one node contains text matching "claude" or "haiku" or "sonnet" or "opus" (model names)
  6. Screenshot: .sisyphus/evidence/task-4-agent-tree-nodes.png
  ```

  **Visual Check Pattern:**
  - Tree nodes should show: Title, agent name, model ID
  - Multi-line node content (title on top, agent/model below)
  - Maintain consistent node sizing

  **Commit**: YES
  - Message: `feat(ui): display agent and model in tree nodes`
  - Files: `src/client/src/components/AgentTree.tsx`
  - Pre-commit: `cd src/client && bun run lint`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `fix(parser): correct message storage path to include sessionID` | messageParser.ts | `bun test` |
| 2 | `feat(api): add agent and modelID to poll response` | index.ts | `curl /api/poll \| jq` |
| 3 | `feat(ui): display agent name in session list` | SessionList.tsx | Browser check |
| 4 | `feat(ui): display agent and model in tree nodes` | AgentTree.tsx | Browser check |

---

## Success Criteria

### Verification Commands
```bash
# Task 1: Messages are found
curl -s "http://localhost:50234/api/sessions/$(curl -s http://localhost:50234/api/poll | jq -r '.sessions[0].id')/messages" | jq 'length'
# Expected: > 0

# Task 2: Poll includes agent/model
curl -s http://localhost:50234/api/poll | jq '.sessions[0] | keys'
# Expected: Contains "agent" and "modelID"

# Tasks 3 & 4: Visual verification via Playwright
# See individual task acceptance criteria
```

### Final Checklist
- [x] Messages endpoint returns data for active sessions (verified: 21 messages)
- [x] Poll response includes agent and modelID fields (verified: agent="atlas", modelID="kimi-k2.5-free")
- [x] SessionList shows agent name badge (verified via screenshot)
- [x] AgentTree nodes show agent and model (verified via screenshot)
- [x] Edge case: Sessions with 0 messages show gracefully (hidden when null)
- [x] No agent filtering UI added (guardrail followed)
- [x] No token/cost display added (guardrail followed)
- [x] Polling still at 2s interval (no change made)
