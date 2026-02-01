# Agent & Model Dashboard Redesign

## TL;DR

> **Quick Summary**: Transform ocwatch dashboard from session-based tree to live agent simulation with force-directed layout, showing agent types, models, and hierarchy in real-time. Fix broken tools bar pipeline.
> 
> **Deliverables**:
> - Force-directed agent visualization (replaces horizontal dagre tree)
> - Agent nodes showing: type, model, task, status (pulsing/dimmed), call count
> - Session stats bar with agent/model usage counts
> - Agent detail panel (slide-in on click)
> - Working tools bar with recent tool calls
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 7

---

## Context

### Original Request
User wants to see which agents are being called and what models they're using. The main dashboard shows nodes in a horizontal line and doesn't provide useful information. Tools bar at bottom shows nothing.

### Interview Summary
**Key Discussions**:
- Visualization: Force-directed graph (not hierarchical tree)
- Data model: Agent hierarchy (not session hierarchy) - CRITICAL distinction
- Node content: Agent type + model + task + status + call count
- Detail view: Slide-in panel from right on agent click
- Stats: Session stats bar at top showing agent/model usage
- Tools bar: Fix broken pipeline (currently hardcoded empty array)
- Sidebar: Keep for session history

**Research Findings**:
- React Flow supports d3-force layout (see reactflow.dev/examples/layout/force-layout)
- Current AgentTree uses dagre with sessions as nodes - needs complete redesign
- Agent/model data exists in messages (agent, modelID, mode fields)
- buildAgentHierarchy() already computes parent→child agent relationships
- ToolCalls component ready but receives `toolCalls={[]}` in App.tsx:105
- partParser.ts exists but isn't aggregating tool calls

### Metis Review
**Identified Gaps** (addressed):
- Session vs Agent confusion: Clarified - nodes = agents, not sessions
- Animation specs: Defined - 1.5s pulse, #3b82f6 blue, 0.5 opacity dimmed
- Performance bounds: Limited to 100 tool calls, standard React Flow virtualization
- Edge cases: Defined fallbacks for missing data

---

## Work Objectives

### Core Objective
Replace the current session-based horizontal tree with a live force-directed agent visualization that shows agent types, models, hierarchy, and real-time status. Fix the broken tools bar data pipeline.

### Concrete Deliverables
- `src/shared/types/index.ts` - New `AgentNodeData` interface (see Type Definitions below)
- `src/client/src/components/AgentGraph.tsx` - New force-directed visualization
- `src/client/src/components/AgentNode.tsx` - Custom node with agent info + animations
- `src/client/src/components/AgentDetailPanel.tsx` - Slide-in detail panel
- `src/client/src/components/SessionStats.tsx` - Stats bar component
- `src/server/index.ts` - New `/api/sessions/:id/agents` endpoint
- `src/server/index.ts` - New `/api/sessions/:id/tools` endpoint
- `src/server/storage/partParser.ts` - New `getPartsForMessage()` function
- Updated `src/client/src/store/AppContext.tsx` with toolCalls state
- Updated `src/client/src/App.tsx` wiring everything together

### Type Definitions (NEW - Required Before Implementation)

**Add to `src/shared/types/index.ts`:**

```typescript
/**
 * AgentNodeData represents an agent in the visualization
 * NOTE: This is DIFFERENT from existing AgentInfo type
 */
export interface AgentNodeData {
  id: string;                    // Unique agent instance ID (e.g., "explore_msg123")
  name: string;                  // Agent type (e.g., "explore", "oracle")
  modelID: string;               // Model used (e.g., "claude-sonnet-4")
  task: string;                  // Task summary (truncated to 100 chars)
  status: "active" | "completed"; // Based on last message time
  callCount: number;             // Number of messages from this agent
  parentAgentId?: string;        // ID of parent agent (for hierarchy)
  sessionID: string;             // Session this agent belongs to
  lastMessageTime: Date;         // For determining active status
}
```

### Data Access Patterns (CRITICAL)

**Part files are organized by messageID:**
```
storage/part/{messageID}/{partID}.json
```

**NOTE**: The current `partParser.ts:getPart()` has an OUTDATED path (`storage/part/{partID}.json`).
The actual filesystem structure is `storage/part/{messageID}/{partID}.json` (verified).
Task 2 must UPDATE `partParser.ts` to use the correct path structure.

**Part JSON structure** (raw file, more fields than PartMeta exposes):
```json
{
  "id": "prt_xxx",
  "type": "text" | "tool-use" | "tool-result",
  "text": "...",              // Present for type="text"
  "tool": "read_file",        // Present for tool calls
  "state": "complete",        // Present for tool calls
  "time": { "start": 123, "end": 456 },
  "messageID": "msg_xxx",
  "sessionID": "ses_xxx"
}
```

**PartMeta type update required**: Current type doesn't include `text` or `time`.
Task 2 must EXTEND `PartMeta` in `src/shared/types/index.ts` to add:
- `text?: string`
- `time?: { start: number; end: number }`

And update `parsePart()` to extract these fields from the JSON.

**Tool calls approach:**
1. Get messages for session: `listMessages(sessionID)` (already exists in server)
2. For each messageID, list: `storage/part/{messageID}/*.json`
3. Parse each part file, filter where `tool` field is present
4. Convert to ToolCall using `time.start` as timestamp

**Task extraction approach:**
1. Find the first user message that triggered the agent (via parentID chain)
2. Read parts for that message: `storage/part/{messageID}/*.json`
3. Find part with `type: "text"`, get `text` field
4. Truncate to 100 chars
5. Fallback: Use session.title if no text part found

### Definition of Done
- [ ] Agent nodes visible with type, model, task, status, call count
- [ ] Force-directed layout positions nodes dynamically
- [ ] Active agents pulse with blue glow animation
- [ ] Completed agents dimmed at 0.5 opacity
- [ ] Clicking agent opens detail panel with messages/tools
- [ ] Session stats bar shows agent/model counts
- [ ] Tools bar displays recent 50 tool calls
- [ ] All unit tests pass
- [ ] Visual verification via Playwright passes

### Must Have
- Agent type displayed on each node
- Model ID displayed on each node
- Visual distinction between active/completed agents
- Agent hierarchy (parent→child edges)
- Tools bar showing actual tool call data
- Session stats with counts

### Must NOT Have (Guardrails)
- Physics controls for force-directed layout
- Message content viewer in detail panel (summary only)
- Tool execution replay/debugging
- Filtering/search in any component
- Custom animation timing controls
- Token/cost tracking
- Charts or historical analytics
- Export functionality

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest for client, Bun test for server)
- **User wants tests**: YES (both unit + manual)
- **Framework**: Vitest (client), Bun test (server), Playwright (visual)

### Automated Verification

**For API changes** (using Bash curl):
```bash
# Agent endpoint returns data
curl -s http://localhost:50234/api/sessions/{session_id}/agents | jq 'length'
# Assert: > 0

# Tools endpoint returns data
curl -s http://localhost:50234/api/sessions/{session_id}/tools | jq 'length'
# Assert: > 0
```

**For UI changes** (using Playwright skill):
```
1. Navigate to: http://localhost:50234
2. Wait for: selector '[data-testid="agent-graph"]' to be visible
3. Assert: At least one '.react-flow__node' exists
4. Click: first '.react-flow__node'
5. Wait for: selector '[data-testid="agent-detail-panel"]' to be visible
6. Assert: Panel contains agent type text
7. Screenshot: .sisyphus/evidence/agent-graph.png
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add /api/sessions/:id/agents endpoint
├── Task 2: Add /api/sessions/:id/tools endpoint
└── Task 6: Add toolCalls to AppContext

Wave 2 (After Wave 1):
├── Task 3: Create AgentNode component with animations
├── Task 4: Create AgentGraph with d3-force layout
├── Task 5: Create SessionStats component
├── Task 7: Wire tools bar to context
└── Task 8: Create AgentDetailPanel

Wave 3 (After Wave 2):
└── Task 9: Integration + visual testing

Critical Path: Task 1 → Task 4 → Task 8 → Task 9
Parallel Speedup: ~40% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 4 | 2, 6 |
| 2 | None | 7 | 1, 6 |
| 3 | None | 4 | 1, 2, 6 |
| 4 | 1, 3 | 8, 9 | 5, 7 |
| 5 | None | 9 | 3, 4, 7, 8 |
| 6 | None | 7 | 1, 2 |
| 7 | 2, 6 | 9 | 4, 5, 8 |
| 8 | 4 | 9 | 5, 7 |
| 9 | 4, 5, 7, 8 | None | None (final) |

---

## TODOs

- [ ] 1. Add `/api/sessions/:id/agents` endpoint

  **What to do**:
  - First, add `AgentNodeData` interface to `src/shared/types/index.ts` (see Type Definitions above)
  - Create new endpoint in `src/server/index.ts`
  - Build agent hierarchy from messages in session:
    1. Get all messages for session
    2. Group messages by `agent` field
    3. For each unique agent, create AgentNodeData:
       - `id`: `{agent}_{firstMessageId}` (unique per agent instance)
       - `name`: message.agent
       - `modelID`: message.modelID
       - `task`: Extract from first text part (see below) or session.title
       - `status`: "active" if lastMessageTime < 5 min ago, else "completed"
       - `callCount`: count of messages with this agent
       - `parentAgentId`: Find parent message's agent via parentID chain
  - **Task extraction**:
    1. Find first message with this agent
    2. Read `storage/part/{messageID}/*.json` files
    3. Find part with `type: "text"`, get `text` field
    4. Truncate to 100 chars
    5. Fallback: session.title or "No task description"

  **Must NOT do**:
  - Include full message content (only task summary)
  - Return more than 100 agents per session
  - Use the existing `AgentInfo` type (it has different fields)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Moderate complexity - new type + endpoint + part reading
  - **Skills**: []
    - No special skills needed - standard TypeScript/Hono

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 6)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `src/server/index.ts:35-53` - Existing `buildAgentHierarchy()` function (uses different approach, reference for pattern only)
  - `src/server/index.ts:166-200` - Pattern for session endpoints
  - `src/server/storage/messageParser.ts:18-30` - MessageMeta type with agent, modelID, parentID fields
  - `src/server/storage/partParser.ts:33-50` - `parsePart()` function for reading part files
  - Part file structure: `storage/part/{messageID}/{partID}.json` - contains `type`, `text` fields

  **Acceptance Criteria**:
  ```bash
  # API returns agent data with correct type
  curl -s http://localhost:50234/api/sessions/ses_test123/agents | jq '.[0] | keys'
  # Assert: Contains ["id", "name", "modelID", "task", "status", "callCount", "sessionID"]
  
  # Status is "active" or "completed"
  curl -s http://localhost:50234/api/sessions/ses_test123/agents | jq '.[0].status'
  # Assert: "active" or "completed"
  
  # Task field is populated (not empty)
  curl -s http://localhost:50234/api/sessions/ses_test123/agents | jq '.[0].task | length'
  # Assert: > 0
  ```

  **Commit**: YES
  - Message: `feat(api): add /api/sessions/:id/agents endpoint for agent hierarchy`
  - Files: `src/shared/types/index.ts`, `src/server/index.ts`
  - Pre-commit: `bun test src/server`

---

- [ ] 2. Add `/api/sessions/:id/tools` endpoint

  **What to do**:
  
  **Step 1: Extend PartMeta type** in `src/shared/types/index.ts`:
  ```typescript
  export interface PartMeta {
    id: string;
    sessionID: string;
    messageID: string;
    type: string;
    callID?: string;
    tool?: string;
    state?: string;
    text?: string;                          // ADD: For task extraction
    time?: { start: number; end: number };  // ADD: For timestamps
  }
  ```

  **Step 2: Update parsePart()** in `src/server/storage/partParser.ts`:
  - Extract `text` and `time` fields from JSON (already present in files, just not parsed)
  - Update return object to include these fields

  **Step 3: Fix getPart() path** (CRITICAL - current code has wrong path):
  - Current (WRONG): `storage/part/${partID}.json`
  - Correct: `storage/part/${messageID}/${partID}.json`
  - This function needs messageID parameter or should be deprecated

  **Step 4: Add getPartsForMessage() function**:
  ```typescript
  import { readdir } from "node:fs/promises";
  
  export async function getPartsForMessage(
    messageID: string,
    storagePath?: string
  ): Promise<PartMeta[]> {
    const basePath = storagePath || getStoragePath();
    const partDir = join(basePath, "opencode", "storage", "part", messageID);
    try {
      const files = await readdir(partDir);
      const parts = await Promise.all(
        files.filter(f => f.endsWith('.json'))
             .map(f => parsePart(join(partDir, f)))
      );
      return parts.filter((p): p is PartMeta => p !== null);
    } catch {
      return []; // Directory doesn't exist = no parts
    }
  }
  ```

  **Step 5: Create endpoint** in `src/server/index.ts`:
  1. Get messages for session: use `listMessages(sessionID)` (exists at line ~166)
  2. For each message, call `getPartsForMessage(messageID)`
  3. Filter parts where `tool` field is present (indicates tool call)
  4. Convert to ToolCall: `{id, name: part.tool!, state: part.state, timestamp: new Date(part.time!.start), sessionID, messageID}`
  5. Sort by timestamp descending, limit to 50

  **Must NOT do**:
  - Scan all 25k+ part files (only list directories for session's messages)
  - Include tool input/output content (only metadata)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Type updates + parser updates + new function + endpoint
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 6)
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:
  - `src/server/storage/partParser.ts:33-50` - Existing `parsePart()` to UPDATE
  - `src/shared/types/index.ts:40-48` - PartMeta type to EXTEND
  - `src/shared/types/index.ts:64-71` - ToolCall type (already correct)
  - `src/server/index.ts:166-200` - Pattern for session endpoints, `listMessages()` function
  - Actual part storage: `~/.local/share/opencode/storage/part/{messageID}/{partID}.json`

  **Acceptance Criteria**:
  ```bash
  # API returns tool calls
  curl -s http://localhost:50234/api/sessions/ses_test123/tools | jq 'length'
  # Assert: >= 0 (empty array OK if no tools)
  
  # Tool call has required fields (if tools exist)
  curl -s http://localhost:50234/api/sessions/ses_test123/tools | jq '.[0] | keys'
  # Assert: Contains ["id", "name", "state", "timestamp", "sessionID", "messageID"]
  ```

  **Commit**: YES
  - Message: `feat(api): add /api/sessions/:id/tools endpoint with extended part parsing`
  - Files: `src/shared/types/index.ts`, `src/server/storage/partParser.ts`, `src/server/index.ts`
  - Pre-commit: `bun test src/server`

---

- [ ] 3. Create AgentNode component with animations

  **What to do**:
  - Create `src/client/src/components/AgentNode.tsx`
  - Custom React Flow node component
  - Display: agent name, model, task (truncated), call count
  - CSS animation: `@keyframes pulse` for active agents (1.5s, #3b82f6 glow)
  - Dimmed style for completed agents (opacity: 0.5)
  - Add `data-testid="agent-node"`

  **Must NOT do**:
  - Custom animation controls
  - Complex state management (receive props only)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with CSS animations
  - **Skills**: [`frontend-ui-ux`]
    - frontend-ui-ux: Styling and animation expertise

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 6)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `src/client/src/components/AgentTree.tsx:70-86` - Existing node styling pattern
  - React Flow custom nodes: https://reactflow.dev/docs/guides/custom-nodes/
  - `src/shared/types/index.ts` - Use new `AgentNodeData` type for props (NOT AgentInfo)

  **Acceptance Criteria**:
  ```
  # Playwright verification:
  1. Navigate to: http://localhost:50234
  2. Wait for: selector '[data-testid="agent-node"]' to be visible
  3. Assert: Node contains text matching agent name pattern (e.g., "explore", "oracle")
  4. Assert: Active node has CSS animation (check computed style)
  5. Screenshot: .sisyphus/evidence/agent-node.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add AgentNode component with pulse animation`
  - Files: `src/client/src/components/AgentNode.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [ ] 4. Create AgentGraph with d3-force layout

  **What to do**:
  - Create `src/client/src/components/AgentGraph.tsx`
  - Replace dagre layout with d3-force simulation
  - Fetch agents from `/api/sessions/:id/agents`
  - Build nodes from **AgentNodeData[]** array (NOT AgentInfo - see Type Definitions)
  - Build edges from `parentAgentId` relationships in AgentNodeData
  - Use React Flow with custom AgentNode component
  - Add `data-testid="agent-graph"`
  - Auto-fit view on data change

  **Must NOT do**:
  - Physics control UI
  - Manual node dragging (keep `nodesDraggable={false}`)
  - Custom force parameters (use React Flow defaults)
  - Use the old `AgentInfo` type (use `AgentNodeData` instead)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex visualization component
  - **Skills**: [`frontend-ui-ux`]
    - frontend-ui-ux: React Flow expertise

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 8, Task 9
  - **Blocked By**: Task 1, Task 3

  **References**:
  - `src/client/src/components/AgentTree.tsx` - Current implementation to replace
  - React Flow d3-force: https://reactflow.dev/examples/layout/force-layout
  - `src/client/src/hooks/usePolling.ts` - Data fetching pattern

  **Acceptance Criteria**:
  ```
  # Playwright verification:
  1. Navigate to: http://localhost:50234
  2. Wait for: selector '[data-testid="agent-graph"]' to be visible
  3. Count: '.react-flow__node' elements
  4. Assert: Count > 0 (at least one agent visible)
  5. Assert: Nodes are NOT in a horizontal line (check Y positions vary)
  6. Screenshot: .sisyphus/evidence/agent-graph-layout.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add AgentGraph with d3-force layout`
  - Files: `src/client/src/components/AgentGraph.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [ ] 5. Create SessionStats component

  **What to do**:
  - Create `src/client/src/components/SessionStats.tsx`
  - Display compact stats bar: "explore: 5 (sonnet) | oracle: 2 (opus)"
  - Calculate counts from agents data
  - Group by agent name, show model in parentheses
  - Add `data-testid="session-stats"`
  - Style as horizontal bar at top of main area

  **Must NOT do**:
  - Charts or visualizations
  - Historical data
  - Click interactions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple presentational component
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 7, 8)
  - **Blocks**: Task 9
  - **Blocked By**: None

  **References**:
  - `src/client/src/components/PlanProgress.tsx` - Similar compact display pattern
  - `src/shared/types/index.ts` - Use new `AgentNodeData` type (NOT AgentInfo)

  **Acceptance Criteria**:
  ```
  # Playwright verification:
  1. Navigate to: http://localhost:50234
  2. Wait for: selector '[data-testid="session-stats"]' to be visible
  3. Get text content of stats bar
  4. Assert: Text matches pattern like "explore: N (model)"
  5. Screenshot: .sisyphus/evidence/session-stats.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add SessionStats component for agent/model counts`
  - Files: `src/client/src/components/SessionStats.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [ ] 6. Add toolCalls to AppContext

  **What to do**:
  - Update `src/client/src/store/AppContext.tsx`
  - Add `toolCalls: ToolCall[]` to context state
  - Add `setToolCalls` setter
  - Initialize as empty array
  - Update `AppContextValue` interface

  **Must NOT do**:
  - Fetch logic (that goes in usePolling)
  - Tool call filtering

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple state addition
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:
  - `src/client/src/store/AppContext.tsx` - Current context implementation
  - `src/shared/types/index.ts:64-71` - ToolCall type

  **Acceptance Criteria**:
  ```bash
  # Unit test passes
  cd src/client && bun run test -- --grep "AppContext"
  # Assert: Test file runs without errors
  ```

  **Commit**: YES (groups with Task 7)
  - Message: `feat(state): add toolCalls to AppContext`
  - Files: `src/client/src/store/AppContext.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [ ] 7. Wire tools bar to context

  **What to do**:
  - Update `src/client/src/hooks/usePolling.ts` to fetch tools
  - Call `/api/sessions/:id/tools` for active session
  - Update context with `setToolCalls`
  - Update `src/client/src/App.tsx` to pass `toolCalls` from context
  - Remove hardcoded `toolCalls={[]}` on line 105

  **Must NOT do**:
  - Modify ToolCalls component (already works)
  - Add filtering logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Wiring existing components
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 8)
  - **Blocks**: Task 9
  - **Blocked By**: Task 2, Task 6

  **References**:
  - `src/client/src/App.tsx:105` - Hardcoded empty array to fix
  - `src/client/src/hooks/usePolling.ts` - Polling hook to extend
  - `src/client/src/components/ToolCalls.tsx` - Component that receives data

  **Acceptance Criteria**:
  ```
  # Playwright verification:
  1. Navigate to: http://localhost:50234
  2. Wait for: selector '[data-testid="tool-calls-panel"]' to be visible
  3. Count: Tool call items in panel
  4. Assert: Count > 0 (if session has tool calls)
  5. Screenshot: .sisyphus/evidence/tools-bar.png
  ```

  **Commit**: YES
  - Message: `fix(ui): wire tools bar to API data instead of hardcoded empty array`
  - Files: `src/client/src/App.tsx`, `src/client/src/hooks/usePolling.ts`
  - Pre-commit: `cd src/client && bun run test`

---

- [ ] 8. Create AgentDetailPanel component

  **What to do**:
  - Create `src/client/src/components/AgentDetailPanel.tsx`
  - Slide-in panel from right edge (width: 400px)
  - Show: agent name, model, task, call count, status
  - List messages sent by this agent (summary, not full content)
  - List tools called by this agent
  - Close button (X) and click-outside to close
  - Add `data-testid="agent-detail-panel"`

  **Must NOT do**:
  - Full message content viewer
  - Tool execution replay
  - Persist panel state

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Slide-in panel with animation
  - **Skills**: [`frontend-ui-ux`]
    - frontend-ui-ux: Panel animation and layout

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 7)
  - **Blocks**: Task 9
  - **Blocked By**: Task 4

  **References**:
  - `src/client/src/components/ToolCalls.tsx` - Similar collapsible panel pattern
  - Slide-in animation: CSS `transform: translateX()`

  **Acceptance Criteria**:
  ```
  # Playwright verification:
  1. Navigate to: http://localhost:50234
  2. Click: first '[data-testid="agent-node"]'
  3. Wait for: selector '[data-testid="agent-detail-panel"]' to be visible
  4. Assert: Panel contains agent name
  5. Click: '[data-testid="panel-close-button"]'
  6. Assert: Panel is no longer visible
  7. Screenshot: .sisyphus/evidence/agent-detail-panel.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add AgentDetailPanel with slide-in animation`
  - Files: `src/client/src/components/AgentDetailPanel.tsx`
  - Pre-commit: `cd src/client && bun run test`

---

- [ ] 9. Integration and visual testing

  **What to do**:
  - Update `src/client/src/App.tsx` to wire all components together
  - Replace AgentTree with AgentGraph
  - Add SessionStats above graph
  - Add AgentDetailPanel (hidden by default)
  - Add state for selected agent
  - Run full Playwright visual test suite
  - Capture screenshots for all components

  **Must NOT do**:
  - Add new features beyond integration
  - Modify component internals

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Final integration with visual testing
  - **Skills**: [`playwright`, `frontend-ui-ux`]
    - playwright: Visual testing automation
    - frontend-ui-ux: Integration verification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocks**: None
  - **Blocked By**: Tasks 4, 5, 7, 8

  **References**:
  - `src/client/src/App.tsx` - Main app to update
  - All new components created in previous tasks

  **Acceptance Criteria**:
  ```
  # Full visual test via Playwright:
  1. Navigate to: http://localhost:50234
  2. Wait for: page to fully load
  
  # Verify session stats
  3. Assert: '[data-testid="session-stats"]' is visible
  4. Assert: Contains agent count text
  
  # Verify agent graph
  5. Assert: '[data-testid="agent-graph"]' is visible
  6. Count: Agent nodes > 0
  7. Assert: Nodes have varied Y positions (force layout working)
  
  # Verify agent detail panel
  8. Click: First agent node
  9. Assert: '[data-testid="agent-detail-panel"]' slides in
  10. Assert: Panel shows agent info
  
  # Verify tools bar
  11. Assert: '[data-testid="tool-calls-panel"]' shows data
  
  # Final screenshots
  12. Screenshot: .sisyphus/evidence/final-dashboard.png
  
  # Run all tests
  bun test && cd src/client && bun run test
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(ui): integrate agent dashboard components`
  - Files: `src/client/src/App.tsx`
  - Pre-commit: `bun test && cd src/client && bun run test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(api): add /api/sessions/:id/agents endpoint` | server/index.ts | `bun test src/server` |
| 2 | `feat(api): add /api/sessions/:id/tools endpoint` | server/index.ts, partParser.ts | `bun test src/server` |
| 3 | `feat(ui): add AgentNode component with pulse animation` | AgentNode.tsx | `cd src/client && bun run test` |
| 4 | `feat(ui): add AgentGraph with d3-force layout` | AgentGraph.tsx | `cd src/client && bun run test` |
| 5 | `feat(ui): add SessionStats component` | SessionStats.tsx | `cd src/client && bun run test` |
| 6+7 | `fix(ui): wire tools bar to API data` | AppContext.tsx, usePolling.ts, App.tsx | `cd src/client && bun run test` |
| 8 | `feat(ui): add AgentDetailPanel` | AgentDetailPanel.tsx | `cd src/client && bun run test` |
| 9 | `feat(ui): integrate agent dashboard components` | App.tsx | `bun test && cd src/client && bun run test` |

---

## Success Criteria

### Verification Commands
```bash
# Server tests pass
bun test src/server

# Client tests pass  
cd src/client && bun run test

# Server starts
bun run start &
sleep 2

# API endpoints work
curl -s http://localhost:50234/api/sessions | jq '.[0].id' | xargs -I{} curl -s http://localhost:50234/api/sessions/{}/agents | jq 'length'
curl -s http://localhost:50234/api/sessions | jq '.[0].id' | xargs -I{} curl -s http://localhost:50234/api/sessions/{}/tools | jq 'length'

# Visual test (Playwright)
# See Task 9 acceptance criteria
```

### Final Checklist
- [ ] Agent nodes visible with type + model + task + status
- [ ] Force-directed layout (nodes not in horizontal line)
- [ ] Active agents have pulsing blue glow
- [ ] Completed agents dimmed at 0.5 opacity
- [ ] Session stats bar shows agent/model counts
- [ ] Clicking agent opens detail panel
- [ ] Detail panel shows agent info and tools
- [ ] Tools bar shows recent tool calls (not empty)
- [ ] All tests pass
- [ ] No token/cost tracking added
- [ ] No filtering/search added
- [ ] No export functionality added
