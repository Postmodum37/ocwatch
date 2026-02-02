# Draft: SessionStats Compact Redesign

## User Request Summary
User showed screenshot showing:
1. Session Stats panel takes massive vertical space in header
2. Live Activity section is squeezed/too small
3. Model breakdown list is NOT sorted by token count
4. OCWatch branding area has empty space

**Goal**: Make SessionStats compact/inline for header, sort models by tokens

## Current State Analysis

### Server Side (`src/server/index.ts:91-133`)
- `aggregateSessionStats()` function builds model breakdown
- **BUG CONFIRMED (line 127)**: Model breakdown is NOT sorted
  ```ts
  const modelBreakdown = Array.from(modelTokensMap.values());  // UNSORTED!
  ```

### Client Side (`src/client/src/components/SessionStats.tsx`)
- Current: Tall card with `flex flex-col gap-3 p-4 min-w-[300px]`
- Vertical layout with "Session Stats" title
- Model breakdown takes `max-h-48` vertical space
- Uses `Coins`, `Zap` icons from lucide-react

### App.tsx Header (lines 71-95)
- Header uses `flex items-center justify-between gap-4 border-b border-border p-4`
- SessionStats placed in right side `<div className="flex items-center gap-4">`
- PlanProgress is `w-64 hidden lg:block` - hidden on smaller screens

## Research Findings

### Existing Patterns to Follow
1. **Project Dropdown in SessionList.tsx**: 
   - Uses `useState(isDropdownOpen)` pattern
   - Click to toggle, positioned with `absolute top-full`
   - z-10 for overlay

2. **PlanProgress.tsx**: Shows compact header approach
   - Uses progress bar with percentage inline
   - Clean `flex items-center justify-between`

3. **AgentBadge.tsx**: Inline badge pattern
   - `inline-flex items-center px-2.5 py-1 rounded-md`

### Color/Style Variables
- Background: `bg-surface`
- Border: `border-border`
- Text primary: `text-text-primary`
- Text secondary: `text-text-secondary`
- Accent: `text-accent` / `bg-accent`

## Proposed Design

### Compact Inline Layout
```
┌─────────────────────────────────────────────┐
│ ⚡ 445k │ $0.00 │ 5 models ▼                │
└─────────────────────────────────────────────┘
```

On hover/click "5 models ▼" reveals dropdown:
```
┌─────────────────────────────────────────────┐
│ glm-4.7-free          272,723               │
│ gemini-3-flash        118,159               │
│ claude-opus-4-5        25,939               │
│ claude-haiku-4-5       14,733               │
│ claude-sonnet-4-5      13,517               │
└─────────────────────────────────────────────┘
```

### Key Design Decisions
- Single line horizontal layout
- Tokens formatted with `k` suffix (e.g., 445k)
- Show model count + dropdown trigger instead of full list
- Dropdown sorted by tokens descending
- Follow existing dropdown pattern from SessionList

## Scope Boundaries

### IN SCOPE
- Fix server-side sorting in `aggregateSessionStats()`
- Redesign `SessionStats.tsx` component to be compact/inline
- Add dropdown for model breakdown on demand
- Update tests for new structure

### OUT OF SCOPE
- Changing the overall header structure
- Modifying other components
- Adding new dependencies/libraries

## Technical Approach

### Task 1: Server Fix
Location: `src/server/index.ts:127`
Change: Add `.sort((a, b) => b.tokens - a.tokens)` to model breakdown

### Task 2: SessionStats Redesign
Location: `src/client/src/components/SessionStats.tsx`
- Keep same props interface (`stats?: SessionStatsType | null`)
- Change from vertical card to horizontal inline
- Add `useState` for dropdown open/close
- Format tokens with k/M suffix helper function
- Dropdown positioned absolute below trigger

### Task 3: Test Updates
Location: `src/client/src/components/__tests__/SessionStats.test.tsx`
- 7 existing tests need adaptation
- Test new dropdown behavior
- Test sorting (already sorted from server)

## Open Questions
None - requirements are clear from screenshot and user description.

## Test Strategy
- Infrastructure EXISTS: Vitest with React Testing Library
- Tests ALREADY exist for SessionStats
- Approach: Update existing tests for new structure
