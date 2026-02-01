# Draft: Live Activity View Rework

## Requirements (confirmed)

- **Core problem**: AgentTree visualizes SESSION hierarchy, NOT live activity within a session
- **User wants**: Live view showing agent calls, tool invocations, delegation chains in real-time
- **Current broken state**: ToolCalls receives `toolCalls=[]` - no data pipeline exists

## Technical Context (discovered)

### Current Data Flow
```
OpenCode Storage → Server Parsers → /api/poll → usePolling → AppContext → UI
```

### Available Data Sources
1. **Sessions** (`SessionMetadata`): Already displayed in SessionList sidebar
2. **Messages** (`MessageMeta`): Exist in storage, API `/api/sessions/:id/messages` exists but NOT polled
3. **Parts** (`PartMeta`): Tool calls stored in part files (25k+ files) - lazy load only

### Key Data for Live Activity
- `MessageMeta.agent`: Which agent is running
- `MessageMeta.modelID`: Which model the agent uses
- `MessageMeta.parentID`: Delegation chain (agent A spawned agent B)
- `MessageMeta.createdAt`: Timestamp for ordering
- `PartMeta.tool`: Which tool is being called
- `PartMeta.state`: pending/complete/error

## Technical Decisions

### Decision 1: What replaces AgentTree?
**Options**:
1. **Refactor AgentTree to show messages instead of sessions** - Keep React Flow, change data source
2. **New LiveActivity component** - Fresh design, possibly not React Flow
3. **Keep AgentTree + add MessageActivity panel** - Two views

**Considerations**:
- React Flow is heavyweight for simple activity feeds
- Dagre layout makes sense for trees, not for linear activity
- User wants to see: agent calls, models, tool calls, delegation chains

### Decision 2: How to fetch message/part data for live view?
**Options**:
1. **Expand /api/poll to include messages for active session** - Simple, one endpoint
2. **Separate /api/sessions/:id/activity endpoint** - Dedicated endpoint, more flexible
3. **Poll /api/sessions/:id/messages separately** - Uses existing endpoint

### Decision 3: How to show agent delegation hierarchy?
**Options**:
1. **React Flow tree** - Visual hierarchy, but may be overkill
2. **Indented list** - Simple, scannable
3. **Timeline with nesting** - Linear time + hierarchy indicators

## Research Findings

### From Code Analysis
- `buildAgentHierarchy()` function in `src/server/index.ts` already builds parent→child agent mapping from messages
- `/api/sessions/:id` returns `agentHierarchy` but UI doesn't use it
- Messages have `parentID` field linking to parent message (delegation chain)

### From React Flow Patterns
[Awaiting librarian results]

## Final Decisions (User Confirmed)

### 1. Layout: Replace AgentTree Entirely
- Remove AgentTree component from App.tsx
- New `LiveActivity.tsx` component takes its place
- Session list sidebar remains for navigation

### 2. Visualization: Indented Timeline
```
├─ prometheus (anthropic/claude-sonnet-4)       10:30:05
│   └─ tool: mcp_read                           10:30:06 ✓
│   └─ tool: mcp_write                          10:30:08 pending
├─ sisyphus (anthropic/claude-sonnet-4)         10:30:10
│   └─ tool: mcp_bash                           10:30:11 ✓
```

### 3. Data Pipeline
- Show activity for **selected session** from sidebar
- If no selection, show most recent active session
- Limits: 100 messages (existing API limit), lazy load tool calls for visible messages

### 4. Additional Features
- Color-coded agents (sisyphus=blue, prometheus=purple, explore/librarian=green, oracle=amber)
- Auto-scroll to latest activity
- Collapsible tool calls per agent
- Token usage display (if available)

## Scope Boundaries

### INCLUDE
- Live view of messages/agent calls for selected session
- Agent delegation hierarchy visualization
- Tool call activity (inline or panel)
- Real-time polling updates (2s interval maintained)

### EXCLUDE
- WebSocket (HTTP polling only per constraints)
- Historical analytics
- Token/cost estimation
- Search/filter UI
- Export functionality
