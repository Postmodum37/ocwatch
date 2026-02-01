# Client Tests - RED Phase

## Summary
Created RED-phase TDD tests for ToolCallRow component and LiveActivity tool integration.

## Files Created
- `src/client/src/components/__tests__/ToolCallRow.test.tsx` - 11 tests (all failing - component doesn't exist)

## Files Modified
- `src/client/src/components/__tests__/LiveActivity.test.tsx` - Added 4 tests (all failing - integration not implemented)

## Test Coverage

### ToolCallRow Tests (11 tests)
1. **Renders tool name and summary** - Basic rendering
2. **Status badges** - pending/complete/error states with correct icons
3. **Expand/collapse** - Click to expand shows full arguments, click again collapses
4. **Chevron icons** - Shows chevron-right when collapsed, chevron-down when expanded
5. **Timestamp display** - Shows relative time format
6. **Complex input objects** - Handles nested input structures
7. **Empty input** - Handles empty input objects

### LiveActivity Tests (4 new tests)
1. **Agent row with toolCalls shows tool call list** - Verifies tool calls render in session row
2. **Default shows max 5 tool calls** - Collapsed state shows only 5 most recent
3. **Click agent row expands to show all tool calls** - Expand button shows all tool calls
4. **Click agent row again collapses to last 5 tool calls** - Toggle collapse behavior

## Test Patterns Used
- Mock lucide-react icons with data-testid attributes
- Use fireEvent for click interactions
- Test data-testid selectors for expandable content
- Mock ToolCallSummary type from shared types
- Follow existing LiveActivity test patterns

## Expected Failures
```
FAIL src/components/__tests__/ToolCallRow.test.tsx
  Error: Failed to resolve import "../ToolCallRow" - component doesn't exist yet

FAIL src/components/__tests__/LiveActivity.test.tsx (4 tests)
  × agent row with toolCalls shows tool call list
  × default shows max 5 tool calls
  × click agent row expands to show all tool calls
  × click agent row again collapses to last 5 tool calls
```

## Test Assumptions
- ToolCallRow component will accept `toolCall: ToolCallSummary` prop
- SessionRow will have expandable tool calls list
- Tool calls will be limited to 5 in collapsed state
- Expand/collapse controlled by data-testid buttons
- Status indicators use lucide-react icons (Check, Loader2, AlertCircle)

## Next Steps (Task 4)
Implement ToolCallRow component to make tests pass:
- Render tool name and summary
- Show status badge with appropriate icon
- Implement expand/collapse with chevron icons
- Display full arguments when expanded
- Format timestamp as relative time

## Notes
- All tests follow BDD pattern with clear given/when/then structure
- Comments in tests explain test flow (necessary for clarity)
- Tests use existing mocking patterns from LiveActivity.test.tsx
- Pre-existing LSP errors in test setup (Vitest matchers) not addressed in this phase
