# SessionStats Component - Decisions

## Test Structure (Task 2 - RED Phase)

### Test File Created
- **Location**: `src/client/src/components/__tests__/SessionStats.test.tsx`
- **Framework**: Vitest + React Testing Library
- **Status**: RED phase (tests fail - component not implemented)

### Test Coverage
1. **Token Formatting**: Renders total tokens with comma separators (e.g., "18,518 tokens")
2. **Cost Formatting**: Renders cost with $ prefix and 2 decimals (e.g., "$0.23")
3. **Undefined Cost**: Renders "—" when cost is undefined
4. **Model Breakdown**: Renders list with model names and token counts
5. **Null Stats**: Renders "No stats available" when stats is null
6. **Undefined Stats**: Renders "No stats available" when stats is undefined
7. **Empty Breakdown**: Handles empty modelBreakdown array gracefully

### Mock Data Structure
```typescript
{
  totalTokens: 18518,
  cost: 0.23,
  modelBreakdown: [
    { model: 'claude-opus-4', tokens: 10000 },
    { model: 'claude-sonnet-4', tokens: 8518 },
  ]
}
```

### Test Patterns Followed
- Imported from existing test files (PlanProgress.test.tsx, LiveActivity.test.tsx)
- Uses `render()` and `screen` from @testing-library/react
- Uses `describe()`, `it()`, `expect()` from vitest
- Follows naming convention: "renders X" for output tests
- No unnecessary comments (self-documenting test names)

### Dependencies
- SessionStats component type must be defined in @shared/types
- SessionStats component must be created in src/client/src/components/SessionStats.tsx

## Component Implementation: SessionStats
- Date: 2026-02-02
- Implemented `SessionStats` component following the GREEN phase of TDD.
- Used `toLocaleString()` for token formatting and `toFixed(2)` for cost.
- Adopted simple vertical list layout for model breakdown to avoid complexity.
- Used `text-text-secondary` for labels and `text-text-primary` for values for consistent hierarchy.
- Added `truncate` class with `max-w-[180px]` for model names to prevent layout breaking.
- Handled `null/undefined` stats with a "No stats available" empty state using the Coins icon.

## Header Redesign with SessionStats

### Problem
We needed to integrate the new `SessionStats` component into the `App.tsx` header without overcrowding it, while also making the branding more compact.

### Decision
1.  **Compact Branding**: Reduced icon size to `w-5 h-5` (from `w-6 h-6`) and used a single line layout for "OCWatch" and "Activity Monitor" (using `items-baseline`). "Activity Monitor" is hidden on very small screens (`hidden sm:inline-block`).
2.  **SessionStats Placement**: Placed `SessionStats` on the right side of the header.
3.  **PlanProgress Responsiveness**: To accommodate the wide `SessionStats` component (min-width 300px), we hide the `PlanProgress` component on screens smaller than large (`lg`), ensuring the UI doesn't break on tablets/mobile.
4.  **Context Update**: Extended `AppContext` and `usePolling` to propagate `sessionStats` from the API to the UI.

### Trade-offs
- `PlanProgress` is not visible on smaller screens in the header. This was deemed acceptable as `SessionStats` provides real-time token/cost data which is high value, and `PlanProgress` takes up significant horizontal space.
