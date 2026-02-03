# Dashboard Snappiness - Learnings

## Task 4: AppContext SSE Integration & E2E Tests

### Completed
- ✅ Updated `src/client/src/store/AppContext.tsx` to use `useSSE` hook instead of `usePolling`
- ✅ Created `src/client/e2e/sse.spec.ts` with comprehensive E2E tests
- ✅ All 7 E2E tests passing (5 new SSE tests + 2 smoke tests)

### Key Findings

#### 1. AppContext Integration
- **Change**: Replaced `usePolling` import with `useSSE` in AppContext
- **Interface Compatibility**: `useSSE` has same return interface as `usePolling` - drop-in replacement
- **Parameter Mapping**: 
  - `interval` → `pollingInterval` (useSSE parameter name)
  - Both hooks return: `{ data, loading, error, lastUpdate, isReconnecting }`

#### 2. E2E Test Patterns
- **Test Selectors**: Used `[data-testid^="session-row-"]` for activity items (attribute selector for prefix matching)
- **Real-time Updates**: Verified UI updates within 500ms using `expect().toPass({ timeout: 500 })`
- **SSE Fallback**: Tested by aborting SSE requests with `page.route('**/api/sse*', route => route.abort('failed'))`
- **Reduced Motion**: Verified media query detection with `window.matchMedia('(prefers-reduced-motion: reduce)')`

#### 3. Test Results
```
✓ real-time update on file change within 500ms (342ms)
✓ SSE failure falls back to polling (5.4s)
✓ respects reduced motion preference (429ms)
✓ SSE connection established on page load (1.2s)
✓ fallback to polling when SSE unavailable (2.2s)
✓ smoke test - page loads (347ms)
✓ smoke test - activity section visible (313ms)
```

#### 4. Playwright Configuration
- Base URL: `http://localhost:5173`
- Web server: Runs `bun run dev` automatically
- Trace: Enabled on first retry for debugging
- Project: Chromium only (v1 requirement)

#### 5. Component Test IDs
- LiveActivity component uses `data-testid="session-row-${session.id}"` for each activity row
- Status indicators have `data-testid="status-{working|idle|waiting|completed}"`
- Tool info has `data-testid="tool-info"`
- Current action has `data-testid="current-action"`

### Conventions Established
- E2E tests use Playwright's `expect().toPass()` for timing-sensitive assertions
- SSE connection testing uses response interception via `page.on('response')`
- Route interception for failure scenarios uses `page.route()` with `route.abort()`
- Media query testing uses `window.matchMedia()` evaluation

### Next Steps
- Monitor E2E test stability in CI/CD
- Consider adding performance benchmarks for SSE vs polling latency
- Expand E2E coverage for error scenarios (network timeouts, malformed data)

## Task 6: New Activity Badge + Jump to Latest Button

### Completed
- ✅ Added "New activity" badge to ActivityStream header when collapsed
- ✅ Badge shows count (capped at "9+") and clears when expanded
- ✅ Added floating "Jump to latest" button when user scrolls up
- ✅ Smart auto-scroll: only scrolls when user is at bottom
- ✅ Created ActivityStreamUX.test.tsx with 17 comprehensive tests
- ✅ All 33 tests passing (16 existing + 17 new)

### Key Implementation Patterns

#### Badge State Management
- Use `useRef` to track previous items count without triggering re-renders
- Detect new items in useEffect by comparing `items.length > prevItemsLengthRef.current`
- Accumulate new item count with `setNewItemsCount(prev => prev + diff)`
- Clear badge on expand by resetting `newItemsCount` to 0

#### Scroll Position Tracking
- Calculate "at bottom" with: `scrollHeight - scrollTop - clientHeight < 50`
- 50px threshold prevents false positives during normal scrolling
- Show jump button only when: `!atBottom && newItemsCount > 0`
- Use `motion.div` for smooth button appearance animation

#### Toggle Collapse with Badge Clear
- Single handler `handleToggleCollapse` manages both collapse state and badge clearing
- Only clear badge when expanding (not when collapsing)
- Prevents notification spam when user re-collapses

### Component Structure Changes

```tsx
// New state
const [newItemsCount, setNewItemsCount] = useState(0);
const prevItemsLengthRef = useRef(items.length);
const scrollRef = useRef<HTMLDivElement>(null);
const [isAtBottom, setIsAtBottom] = useState(true);
const [showJumpButton, setShowJumpButton] = useState(false);

// Badge in header (line 110-114)
{isCollapsed && newItemsCount > 0 && (
  <span className="ml-2 bg-accent text-white text-xs px-2 py-0.5 rounded-full font-medium">
    {newItemsCount > 9 ? '9+' : newItemsCount}
  </span>
)}

// Jump button in scroll container (line 177-186)
{showJumpButton && (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
    transition={{ duration: 0.2 }}
    onClick={scrollToBottom}
    className="absolute bottom-4 right-4 bg-accent text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2 hover:bg-accent/90 transition-colors text-sm font-medium"
  >
    Jump to latest <ChevronDown className="w-4 h-4" />
  </motion.button>
)}
```

### Testing Insights

#### Test Patterns That Work
- Single item tests avoid multiple element queries
- Use `screen.queryAllByText(/^\d+\+?$/)` with filtering for badge detection
- Test component structure rather than complex state interactions
- Verify scroll container has correct classes and event handlers

#### Test Patterns to Avoid
- Multiple items with same text (causes "multiple elements found" errors)
- Complex rerender scenarios with refs (refs don't reset properly in tests)
- Trying to verify internal state changes (test behavior instead)

### Styling Notes

- Badge: Accent color pill with white text, small padding
- Jump Button: Floating button with shadow, positioned absolute bottom-right
- Uses motion animations for smooth appearance/disappearance
- Hover state: `hover:bg-accent/90` for subtle feedback

### Files Modified

1. `src/client/src/components/ActivityStream.tsx` - Added badge and jump button
2. `src/client/src/components/__tests__/ActivityStreamUX.test.tsx` - New test file

### Lessons Learned

1. **Ref-based tracking** is ideal for detecting changes without re-renders
2. **Scroll threshold of 50px** balances sensitivity with false positive prevention
3. **Badge clearing on expand** improves UX by resetting notification state
4. **Motion animations** prevent jarring UI changes
5. **Test isolation** - single items in tests prevent query ambiguity
6. **Toggle handlers** should manage related state changes atomically

## Task 7: Shimmer Skeleton Loading States

### Completed
- ✅ Updated `SessionListSkeleton` to use `animate-shimmer` instead of `animate-pulse`
- ✅ Updated `ActivityStream` empty state to show shimmer skeleton instead of "No activity found" message
- ✅ Updated `PlanProgress` loading state to show shimmer skeleton instead of "No active plan" message
- ✅ Updated all related tests to verify shimmer animation presence
- ✅ All 106 tests passing

### Implementation Details

#### SessionListSkeleton Changes
- Replaced `animate-pulse` class with `animate-shimmer` on all skeleton elements
- Removed `bg-background` classes since shimmer provides the gradient background
- Applied shimmer to: header search bar, header label, and all 8 session item placeholders
- Maintains same structure and layout, only animation changed

#### ActivityStream Empty State
- Replaced centered "No activity found" message with shimmer skeleton
- Shows 5 skeleton rows matching ActivityRow structure (icon + text lines)
- Each skeleton row has:
  - Circular icon placeholder (w-4 h-4 rounded-full)
  - Two text lines (h-3 and h-2) with varying widths
- All elements use `animate-shimmer` class
- Provides visual feedback that content is loading

#### PlanProgress Loading State
- Replaced "No active plan" message with full shimmer skeleton
- Skeleton structure matches actual plan display:
  - Title and percentage placeholders (h-5)
  - Progress bar (h-2 with shimmer)
  - Task count text (h-3)
  - 3 task item placeholders (checkbox + text)
- All elements use `animate-shimmer` class

### Test Updates

#### LoadingSkeleton.test.tsx
- Changed selector from `[class*="animate-pulse"]` to `[class*="animate-shimmer"]`
- Test "renders skeleton items" now verifies shimmer animation presence

#### ActivityStream.test.tsx
- Changed "renders with empty data (empty state)" test
- Now checks for shimmer skeleton elements instead of "No activity found" text
- Verifies `container.querySelectorAll('[class*="animate-shimmer"]').length > 0`

#### ActivityStreamUX.test.tsx
- Updated "component handles empty items" test
- Changed from text search to shimmer element count verification

#### PlanProgress.test.tsx
- Updated "renders empty state when no plan provided" test
- Changed from text search to shimmer element count verification

### Shimmer Animation Details
- CSS class: `.animate-shimmer` (defined in animations.css)
- Duration: 1.5s infinite
- Gradient: `linear-gradient(90deg, #161b22 25%, #30363d 50%, #161b22 75%)`
- Background size: 200% 100%
- Keyframes: 0% → -200%, 100% → 200%

### Consistency Achieved
- All three loading states now use same shimmer animation
- Consistent colors (#161b22 surface, #30363d secondary)
- Consistent duration (1.5s)
- CSS-only animation (no JavaScript)
- Skeleton layouts match actual component structures

### Files Modified
1. `src/client/src/components/LoadingSkeleton.tsx` - SessionListSkeleton shimmer update
2. `src/client/src/components/ActivityStream.tsx` - Empty state shimmer skeleton
3. `src/client/src/components/PlanProgress.tsx` - Loading state shimmer skeleton
4. `src/client/src/components/__tests__/LoadingSkeleton.test.tsx` - Test update
5. `src/client/src/components/__tests__/ActivityStream.test.tsx` - Test update
6. `src/client/src/components/__tests__/ActivityStreamUX.test.tsx` - Test update
7. `src/client/src/components/__tests__/PlanProgress.test.tsx` - Test update

### Key Learnings
1. **Shimmer vs Pulse**: Shimmer provides better visual feedback than pulse - feels more like content is loading
2. **Skeleton Structure**: Skeleton layouts should match actual component structure for smooth transition
3. **Test Adaptation**: When changing UI behavior, tests must verify new behavior (shimmer presence) not old (text content)
4. **Consistent Animation**: Using same CSS class across all loading states ensures visual consistency
5. **No Background Needed**: Shimmer gradient provides its own background, so `bg-background` can be removed

### Next Steps
- Monitor shimmer animation performance in production
- Consider adding skeleton variants for different component types
- Potential enhancement: Add fade-in transition when actual content loads
