# Draft: Dashboard Task/Model Display Enhancement

## Requirements (confirmed)
- Show the TASK clearly: session title IS the task for child sessions
- Show full MODEL info: provider + model (e.g., "google/gemini-3-pro")
- Show agent name prominently
- Make parent→child spawning relationship visually clear

## Technical Findings

### Current State
1. **Types** (`src/shared/types/index.ts`):
   - `SessionMetadata`: has `agent?: string | null`, `modelID?: string | null`
   - `MessageMeta`: ALREADY has `providerID?: string` (line 31)
   
2. **Message Parser** (`src/server/storage/messageParser.ts`):
   - ALREADY parses `providerID` (line 71): `providerID: json.providerID`
   - ALREADY parses nested model: `modelID: json.modelID || json.model?.modelID`
   - **BUG**: Does NOT parse `json.model?.providerID` - only `json.providerID`

3. **Server** (`src/server/index.ts`):
   - `/api/poll` enriches sessions with agent/modelID from first assistant message
   - **MISSING**: Does NOT include `providerID` in enrichment (lines 326-334)
   
4. **AgentTree.tsx**:
   - Node width: 250px, height: 50px (may need adjustment)
   - Currently shows: title + small agent badge + modelID (too subtle)

### Data Flow Gap
```
Message JSON:
{
  "model": {
    "providerID": "google",      ← NOT parsed from nested
    "modelID": "gemini-3-pro"
  },
  "providerID": "anthropic"       ← Only this is parsed
}
```

## Decisions Made
- **Display format**: `{providerID}/{modelID}` (e.g., "google/gemini-3-pro")
- **Node height increase**: 50px → ~70px to accommodate better layout
- **Task emphasis**: For child sessions, show title as "TASK: {title}"
- **Agent styling**: Larger, more visible badge with colored background

## Open Questions
1. Should we differentiate root sessions vs spawned child sessions visually?
2. Should the full model path be truncated with ellipsis if too long?
3. Any preference on agent badge colors? (Currently gray)

## Scope Boundaries
- INCLUDE: Types, parser, API response, AgentTree node rendering
- EXCLUDE: New dependencies, other components, API structure changes beyond adding providerID
