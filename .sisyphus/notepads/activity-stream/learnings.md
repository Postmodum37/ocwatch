# Activity Stream Learnings

## Project Conventions

### Styling
- Tailwind CSS with dark theme
- Colors: Background `#0d1117`, Surface `#161b22`, Accent `#58a6ff`, Text `#c9d1d9`
- Use `getAgentColor()` from `src/client/src/utils/agentColors.ts` for consistent agent badge colors

### Components
- React Context for state management (no Redux/Zustand)
- Lucide icons for UI
- Status indicators: filled circle (complete), half circle (pending), X (error)

### Patterns from LiveActivity.tsx
- `StatusIndicator` component for status dots
- `formatRelativeTime()` helper for timestamps
- `buildSessionTree()` for traversing agent hierarchy

## Type System
- `ToolCallSummary` has: id, name, state, summary, input, timestamp, agentName
- `ActivitySession` has: hierarchy info, status, tokens, toolCalls[]
- Root cause of empty tool calls: `App.tsx:100` hardcodes `toolCalls={[]}`

## Anti-Patterns (Guardrails)
- NO new npm dependencies for animations (CSS only)
- NO new state management libraries
- NO virtualization for v1
- NO framer-motion or react-spring
- NO backend/API changes (frontend only)

## ActivityItem Union Type (Wave 1)

### Type Structure
- `ActivityType` enum: 'tool-call' | 'agent-spawn' | 'agent-complete'
- `ToolCallActivity`: id, type, timestamp, agentName, toolName, state, summary?, input?, error?
- `AgentSpawnActivity`: id, type, timestamp, agentName, spawnedAgentName
- `AgentCompleteActivity`: id, type, timestamp, agentName, status, durationMs?
- `ActivityItem` union type combines all three

### synthesizeActivityItems() Function
- Takes `ActivitySession[]` and returns `ActivityItem[]`
- Creates spawn events for child sessions (parentID check)
- Converts ToolCallSummary[] to ToolCallActivity[] with timestamp conversion
- Creates complete events for non-working/idle sessions with duration calculation
- Sorts all items by timestamp (oldest first)
- Uses sessionMap for O(1) parent lookup

### Key Implementation Details
- Spawn event ID: `spawn-${sessionId}`
- Complete event ID: `complete-${sessionId}`
- Duration calculated as: `updatedAt.getTime() - createdAt.getTime()`
- Timestamp conversion: `new Date(toolCall.timestamp)` for tool calls
- Status filter: excludes "working" and "idle" for complete events

## CSS Animations (Wave 2, Task 1)

### Created Files
- `src/client/src/styles/animations.css` - Three keyframe animations for activity stream

### Keyframes Implemented
1. **slide-in-from-top** (200ms, ease-out)
   - Opacity: 0 → 1
   - Transform: translateY(-10px) → 0
   - Use case: New activity entries sliding in from top

2. **pulse-bg** (300ms, ease-out)
   - Background: transparent → rgba(88, 166, 255, 0.1) → transparent
   - Uses accent color #58a6ff at 10% opacity
   - Use case: Highlighting recent activity

3. **fade-in** (200ms, ease-out)
   - Opacity: 0 → 1
   - Use case: Smooth appearance of UI elements

### Utility Classes
- `.animate-slide-in-from-top` - Apply slide-in animation
- `.animate-pulse-bg` - Apply pulse background animation
- `.animate-fade-in` - Apply fade-in animation

### Integration
- Imported in `src/client/src/styles/index.css` at top (before @tailwind directives)
- No new npm dependencies (CSS-only solution)
- Build verified: ✓ No warnings, 15.55 kB CSS output

### Tailwind Integration Notes
- Animations use standard CSS @keyframes (not Tailwind @apply)
- Timing values (200ms, 300ms) match Tailwind conventions
- ease-out timing function for natural deceleration
- Utility classes follow Tailwind naming pattern (animate-*)

## Tool Calls Wiring (Wave 2, Task 2)

### Implementation
- **File**: `src/client/src/App.tsx`
- **Change**: Replaced hardcoded `toolCalls={}` with actual data from `activitySessions`

### Data Transformation
- Collect all tool calls using `flatMap()` over `activitySessions`
- Map `ToolCallSummary` → `ToolCall`:
  - `id`: Direct copy
  - `name`: Direct copy
  - `state`: Direct copy (already correct type)
  - `timestamp`: Convert from string to Date using `new Date()`
  - `sessionID`: Use parent session's ID
  - `messageID`: Use tool call ID as proxy (since messageID not in summary)

### Type Safety
- Imported `ToolCall` type from `@shared/types`
- No new type errors introduced (pre-existing JSX config errors ignored)
- Handles optional `toolCalls` array with fallback to empty array

### Notes
- Comments added for clarity on non-obvious patterns (messageID proxy)
- ToolCalls component import kept (will be replaced by ActivityStream in later task)
- No filtering logic added (Task 6 handles that)
