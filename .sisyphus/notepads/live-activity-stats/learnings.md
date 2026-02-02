# Live Activity Stats - Learnings & Decisions

## Conventions

### TypeScript
- Strict mode, verbatimModuleSyntax: true
- Path aliases: @server/, @client/, @shared/

### Number Formatting
- Tokens: comma format (18,518) using `toLocaleString()`
- Cost: $X.XX format, 2 decimal places
- Placeholder when undefined: "—"

### Component Patterns
- Tailwind CSS with dark theme
- Simple list format for model breakdown
- Truncate long model names with ellipsis

### TDD Workflow
- RED: Write failing test first
- GREEN: Implement minimum code to pass
- REFACTOR: Clean up while keeping green

## Dependency Chain

```
Task 1 (types) ──┬──> Task 2 (server) ──┐
                 │                      └──> Task 5 (header)
Task 3 (tests) ──┴──> Task 4 (component) ─┘
```

## Wave Execution
- Wave 1: Tasks 1 + 3 (parallel)
- Wave 2: Tasks 2 + 4 (parallel, after Wave 1)
- Wave 3: Task 5 (sequential, after Wave 2)

## Critical Files
- `src/shared/types/index.ts` - MessageMeta, SessionStats types
- `src/server/storage/messageParser.ts` - parseMessage() with cost
- `src/server/index.ts` - poll endpoint with sessionStats
- `src/client/src/components/SessionStats.tsx` - stats component
- `src/client/src/App.tsx` - header redesign

## Task 2: Cost Extraction and Session Stats Aggregation

**Completed**: 2026-02-02

### Implementation Details

1. **Cost Field Extraction** (`messageParser.ts`)
   - Added `cost: json.cost` to `parseMessage()` return object
   - Field is optional (undefined if not present in JSON)
   - Test coverage: Added tests for both presence and absence of cost field

2. **Session Stats Aggregation** (`index.ts`)
   - Created `aggregateSessionStats()` function after `detectAgentPhases()`
   - Takes `ActivitySession[]` and `Map<string, MessageMeta[]>`
   - Returns `SessionStats` with:
     - `totalTokens`: Sum of all message tokens
     - `totalCost`: Sum of all message costs (undefined if no costs present)
     - `modelBreakdown`: Array of `ModelTokens` grouped by modelID:providerID

3. **Poll Endpoint Integration**
   - Fetches messages for all activity sessions
   - Builds `allMessagesMap` for aggregation
   - Calls `aggregateSessionStats()` and includes result in `PollResponse`
   - Field is optional (undefined when no target session)

### Patterns Followed

- **TDD**: Wrote test first, verified failure, then implemented
- **Existing patterns**: Followed `detectAgentPhases()` aggregation pattern
- **Type safety**: Used existing `SessionStats` and `ModelTokens` types
- **Optional fields**: Used `undefined` for missing data (not null)

### Verification

- All parser tests pass (22/22)
- LSP diagnostics clean on modified files
- Endpoint verified with curl:
  ```json
  {
    "totalTokens": 141578,
    "totalCost": 0,
    "modelBreakdown": [...]
  }
  ```

### Notes

- Cost field extraction is passive (only reads stored values)
- Model breakdown uses composite key: `${modelID}:${providerID}`
- `totalCost` is undefined if no messages have cost data
- Pre-existing client test failures are unrelated (DOM setup issues)
