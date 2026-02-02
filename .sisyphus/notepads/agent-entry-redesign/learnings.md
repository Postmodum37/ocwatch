# Agent Entry Redesign - Notepad

## Task 1: ToolCalls Data Ordering (COMPLETED)

**Finding**: `toolCalls` array is sorted by timestamp **descending** (newest first).

**Location**: `src/server/storage/partParser.ts:329-334`

```typescript
// Sort by timestamp descending (newest first)
toolCalls.sort((a, b) => {
  const timeA = new Date(a.timestamp).getTime();
  const timeB = new Date(b.timestamp).getTime();
  return timeB - timeA;
});
```

**Conclusion**: Use `toolCalls[0]` to get the **current/latest** tool call.

## Type Information

**ToolCallSummary** (from `src/shared/types/index.ts:113-121`):
```typescript
export interface ToolCallSummary {
  id: string;
  name: string;
  state: "pending" | "complete" | "error";
  summary: string;
  input: object;  // Contains filePath, command, pattern, query, url, etc.
  timestamp: string;
  agentName: string;
}
```

**ToolInput** (from `src/shared/types/index.ts:64-71`):
```typescript
export interface ToolInput {
  filePath?: string;
  command?: string;
  pattern?: string;
  url?: string;
  query?: string;
  [key: string]: unknown;
}
```

## Current formatRelativeTime (from LiveActivity.tsx:14-25)

```typescript
function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString();
}
```

## Current SessionRow Layout (from LiveActivity.tsx:122-182)

The SessionRow currently shows:
1. Tree indicator (depth-based)
2. Chevron (if has tool calls)
3. Status indicator
4. Agent badge with color
5. Current action text (truncated max-w-[200px])
6. Model (providerID/modelID)
7. Time (formatRelativeTime)
8. Tokens (right-aligned)

**Key change needed**: Move model/time/tokens to stacked right side, make task summary prominent with inline tool info.

## Design Spec

**New Layout**:
```
[Tree] [Chevron] [Status] [Badge] [TaskSummary (toolName arg)]  |  [model     ]
                                                                  |  [time · tokens]
```

**Requirements**:
- Task summary: ~50 chars max with ellipsis
- Tool display: tool name + primary arg (e.g., 'read src/auth.ts')
- Model: full name, stacked on right
- Time: compact format "4m" not "4m ago"
- Completed agents: dimmed to ~60% opacity (opacity-60 class)

## SessionRow Redesign (Task 3)
- Implemented two-column layout using `flex items-start justify-between`.
- Used `flex-wrap` on the left column to handle long text gracefully while keeping the layout flexible.
- Added `getToolDisplayText` helper to extract and format tool usage (e.g., "read src/auth.ts").
- Stacked metadata (model, time, tokens) on the right side for cleaner look.
- Applied `opacity-60` to completed sessions to reduce visual clutter.
- **Gotcha**: `tsc -b` from root might fail if root `tsconfig.json` doesn't support JSX. Run `tsc -b` inside `src/client` for accurate client-side type checking.
