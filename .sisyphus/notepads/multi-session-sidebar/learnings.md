# Multi-Session Sidebar - Learnings

## Task 2: Project Discovery Implementation

### Implementation Details
- Created `internal/session/project.go` with:
  - `Project` struct containing ID, Worktree, Created, Updated fields
  - `projectJSON` struct for unmarshaling JSON with nested time fields
  - `ListAllProjects(storagePath string)` function
  
- Followed TDD approach:
  - Wrote tests first in `internal/session/project_test.go`
  - Three test cases covering: multiple projects, global exclusion, empty directory
  - All tests passing

### Key Patterns Reused
- `getStoragePath()` pattern from session.go for XDG_DATA_HOME handling
- JSON unmarshaling pattern with nested time struct (created/updated as milliseconds)
- Directory scanning with `os.ReadDir()` and filtering by `.json` extension
- Error handling: continue on individual file errors, return error only for directory read failure

### Global Project Exclusion
- Global project stored as `global.json` with `worktree: "/"`
- Excluded by checking `pj.Worktree == "/"` after unmarshaling
- This prevents the global project from appearing in project lists

### Sorting
- Projects sorted by `Updated` timestamp in descending order (most recent first)
- Used `sort.Slice()` with `Updated.After()` comparison

### Test Results
```
=== RUN   TestListAllProjects_ReturnsMultipleProjects
--- PASS: TestListAllProjects_ReturnsMultipleProjects (0.00s)
=== RUN   TestListAllProjects_ExcludesGlobalProject
--- PASS: TestListAllProjects_ExcludesGlobalProject (0.00s)
=== RUN   TestListAllProjects_HandlesEmptyDirectory
--- PASS: TestListAllProjects_HandlesEmptyDirectory (0.00s)
PASS
ok  	github.com/tomas/ocwatch/internal/session	0.311s
```

### Files Created
- `internal/session/project.go` (69 lines)
- `internal/session/project_test.go` (154 lines)

### Status
✅ Task complete - all tests passing, no LSP errors, build successful

## Task 4: Session Filtering by "Today" Implementation

### Implementation Details
- Added `FilterSessionsByToday(sessions []Session) []Session` to `internal/session/session.go`
- Follows TDD approach: tests written first, then implementation
- Two test cases covering: today's sessions, yesterday's exclusion

### Key Implementation Pattern
- Uses `time.Now().Truncate(24 * time.Hour)` to get midnight of current day
- Filters sessions where `Updated >= midnight` (using `After()` or `Equal()`)
- Matches pattern from `FilterActiveSessions()` function (lines 104-119)
- Simple, efficient filtering with single pass through sessions slice

### Time Boundary Logic
- Sessions updated at exactly midnight are INCLUDED (using `Equal()` check)
- Sessions updated 1 second before midnight are EXCLUDED
- Sessions updated any time after midnight are INCLUDED
- This correctly implements "today = sessions where Updated >= midnight local time"

### Test Coverage
- `TestFilterSessionsByToday_IncludesTodaySessions`: Verifies sessions from today are included
  - Tests session updated 1 minute ago
  - Tests session updated at exactly midnight
- `TestFilterSessionsByToday_ExcludesYesterdaySessions`: Verifies yesterday's sessions are excluded
  - Tests session 1 second before midnight
  - Tests session 1 hour before midnight
  - Confirms today's session is still included

### Test Results
```
=== RUN   TestFilterSessionsByToday_IncludesTodaySessions
--- PASS: TestFilterSessionsByToday_IncludesTodaySessions (0.00s)
=== RUN   TestFilterSessionsByToday_ExcludesYesterdaySessions
--- PASS: TestFilterSessionsByToday_ExcludesYesterdaySessions (0.00s)
PASS
ok  	github.com/tomas/ocwatch/internal/session	0.201s
```

### All Session Tests Passing
- 13 total tests in session package
- All passing including new FilterSessionsByToday tests
- No LSP errors detected
- Function verified with grep at line 121

### Files Modified
- `internal/session/session.go`: Added FilterSessionsByToday function (lines 121-130)
- `internal/session/session_test.go`: Added 2 test functions (lines 288-365)

### Status
✅ Task complete - TDD approach followed, all tests passing, no LSP errors, implementation matches spec

## Task 3: ListAllSessions Implementation

### Implementation Details
- Added `ProjectWorktree` field to Session struct in session.go
- Implemented `ListAllSessions(storagePath string) ([]Session, error)` in project.go
- Function calls `ListAllProjects()` to get all projects
- Creates a map of projectID -> worktree for efficient lookup
- Iterates through each project and calls `ListSessionsWithPath()` 
- Populates `ProjectWorktree` field from the project map
- Sorts combined sessions by Updated timestamp (descending)

### Test Coverage
- `TestListAllSessions_ReturnsSessionsFromMultipleProjects`: Verifies sessions from multiple projects are combined and sorted correctly
- `TestListAllSessions_IncludesProjectInfo`: Verifies ProjectWorktree field is populated correctly

### Key Patterns
- Used map for O(1) lookup of project worktree by ID
- Continued error handling pattern: skip individual failures, don't fail entire operation
- Maintained consistent sorting: Updated desc (newest first)
- TDD approach: tests written first, implementation followed

### Verification
- All tests pass: `go test ./internal/session -v`
- No LSP errors (only workspace warnings which are expected)
- Function and field verified with grep

## Task 5: SessionID to ToolCall and Filtering Methods

### Implementation Details
- Extended `ToolCall` struct with `SessionID string` field (state.go:22)
- Extended `State` struct with:
  - `allSessions []session.Session` (state.go:84)
  - `selectedSessionID string` (state.go:85)
- Added thread-safe state management methods:
  - `SetAllSessions(sessions []session.Session)` - stores all sessions list
  - `SetSelectedSession(sessionID string)` - sets currently selected session
  - `GetSelectedSession() string` - retrieves currently selected session
  - `GetFilteredAgentTree(sessionID string) []AgentInfo` - filters agents by session
  - `GetFilteredToolCalls(sessionID string) []*ToolCall` - filters tool calls by session

### TDD Approach
- Wrote tests FIRST before implementation:
  - `TestToolCallHasSessionID` - verifies SessionID field exists on ToolCall
  - `TestGetAgentTreeFiltered` - verifies agent filtering by sessionID
  - `TestGetRecentToolCallsFiltered` - verifies tool call filtering by sessionID

### Filtering Logic
- When `sessionID == ""`: returns ALL data (no filter applied)
- When `sessionID != ""`: returns only data matching that sessionID
- `GetFilteredAgentTree`: aggregates agents from all sessions when empty, or returns specific session's agents
- `GetFilteredToolCalls`: iterates through ring buffer and filters by SessionID

### Thread Safety
- All new methods use `sync.RWMutex` following existing State patterns
- Read operations use `s.mu.RLock()` / `defer s.mu.RUnlock()`
- Write operations use `s.mu.Lock()` / `defer s.mu.Unlock()`
- Consistent with existing methods like `GetAgentTree()`, `GetRecentToolCalls()`

### Test Results
```
=== RUN   TestToolCallHasSessionID
--- PASS: TestToolCallHasSessionID (0.00s)
=== RUN   TestGetAgentTreeFiltered
--- PASS: TestGetAgentTreeFiltered (0.00s)
=== RUN   TestGetRecentToolCallsFiltered
--- PASS: TestGetRecentToolCallsFiltered (0.00s)
PASS
ok  	github.com/tomas/ocwatch/internal/state	0.363s
```

### All State Tests Passing
- 13 total tests in state package (including 3 new tests)
- All passing including new filtering tests
- No build errors: `go build ./internal/state` succeeds
- LSP warnings are workspace-related only, no actual code errors

### Files Modified
- `internal/state/state.go`: 
  - Extended ToolCall struct (line 22)
  - Extended State struct (lines 84-85)
  - Added 5 new methods (lines 227-285)
- `internal/state/state_test.go`: Added 3 test functions (lines 322-461)

### Status
✅ Task complete - TDD approach followed, all tests passing, no errors, thread-safe implementation

## Task 6: Sidebar Implementation (TDD)

### Implementation Details
- Created `internal/ui/sidebar.go` and `internal/ui/sidebar_test.go`.
- Implemented `renderSidebar(styles Styles, sessions []session.Session, selectedIdx int, height int) string`.
- Designed for fixed width of 28 characters (24 chars content + borders/padding).
- Logic handles:
  - Project name extraction using `filepath.Base`.
  - Session slug display on second line.
  - Numbered list for top 9 sessions (1-9).
  - Indentation for >9 sessions.
  - Truncation with ellipsis for long names.
  - Highlighting of selected session.
  - Handle >9 sessions: show all but only 1-9 have numbers

### TDD Approach
- Wrote tests FIRST covering all requirements:
  - `TestRenderSidebar_ShowsProjectName`
  - `TestRenderSidebar_ShowsSessionNumbers`
  - `TestRenderSidebar_HighlightsSelected`
  - `TestRenderSidebar_FixedWidth`
  - `TestRenderSidebar_HandleMoreThanNine`

### Test Results
```
=== RUN   TestRenderSidebar_ShowsProjectName
--- PASS: TestRenderSidebar_ShowsProjectName (0.00s)
=== RUN   TestRenderSidebar_ShowsSessionNumbers
--- PASS: TestRenderSidebar_ShowsSessionNumbers (0.00s)
=== RUN   TestRenderSidebar_HighlightsSelected
--- PASS: TestRenderSidebar_HighlightsSelected (0.00s)
=== RUN   TestRenderSidebar_FixedWidth
--- PASS: TestRenderSidebar_FixedWidth (0.00s)
=== RUN   TestRenderSidebar_HandleMoreThanNine
--- PASS: TestRenderSidebar_HandleMoreThanNine (0.00s)
PASS
ok  	github.com/tomas/ocwatch/internal/ui	0.354s
```

### Files Created
- `internal/ui/sidebar.go`
- `internal/ui/sidebar_test.go`

### Status
✅ Task complete - TDD followed, tests passing, UI logic implemented cleanly.

## Task 7: Horizontal Layout with Sidebar

### Implementation Details
- Modified `Model` struct in `internal/ui/ui.go` to add `allSessions` and `selectedSessionIdx`.
- Rewrote `View()` method to use `lipgloss.JoinHorizontal`:
  - Implemented logic to hide sidebar if terminal width < 60.
  - Calculated `sidebarHeight` as `m.height - lipgloss.Height(statusBar)` to ensure the status bar remains full-width at the bottom.
  - Sidebar panel is rendered to the left of the main content stack (header, sessions, agents, tools, stats, plan).
  - Main content stack width is adjusted dynamically (`m.width - sidebarWidth` if sidebar is shown).
- Correctly mapped `selectedSessionIdx` (0=None, 1..9=Index+1) to `renderSidebar` (0-based index) by passing `idx - 1`.

### Layout Strategy
- **Status Bar**: Kept outside the horizontal split, at the very bottom, spanning full width. This ensures consistent footer appearance.
- **Sidebar**: Fixed width (28 chars), height matches the main content area (above status bar).
- **Right Stack**: Takes remaining width. Heights of internal components (Stats, Header) are recalculated based on this reduced width.

### Verification
- `go build ./cmd/ocwatch` succeeded.
- `lsp_diagnostics` reported no errors.
- Existing UI tests passed.

### Files Modified
- `internal/ui/ui.go`

### Status
✅ Task complete - Layout implemented, responsive to width < 60, builds successfully.

## Task 8: Number Key Handlers (0-9) Implementation

### Implementation Details
- Added keyboard handlers in `Update()` method for keys "0" through "9"
- Key "0": Clears selection (`selectedSessionIdx = 0`, calls `state.SetSelectedSession("")`)
- Keys "1"-"9": Set `selectedSessionIdx` to key number if valid session exists
- Invalid keys (key > number of sessions) are silently ignored
- State's selected session ID is updated via `state.SetSelectedSession(sessionID)`

### TDD Approach
- Wrote tests FIRST before implementation:
  - `TestKeyHandler_ZeroClearsSelection` - verifies key 0 clears selection
  - `TestKeyHandler_NumberSelectsSession` - verifies keys 1-9 select sessions and ignore invalid keys

### Key Implementation Pattern
- Used `msg.String()[0] - '0'` to convert key character to numeric value
- Bounds check: `if keyNum > 0 && keyNum <= len(m.allSessions)`
- Direct array indexing: `m.allSessions[keyNum-1].ID` (1-based key to 0-based index)
- Thread-safe state update via `m.state.SetSelectedSession()`

### Test Coverage
- `TestKeyHandler_ZeroClearsSelection`: 
  - Verifies selectedSessionIdx becomes 0
  - Verifies state's selectedSessionID becomes empty string
- `TestKeyHandler_NumberSelectsSession`:
  - Tests key "1" selects first session
  - Tests key "3" selects third session
  - Tests key "9" with only 3 sessions is ignored (no state change)

### Test Results
```
=== RUN   TestKeyHandler_ZeroClearsSelection
--- PASS: TestKeyHandler_ZeroClearsSelection (0.00s)
=== RUN   TestKeyHandler_NumberSelectsSession
--- PASS: TestKeyHandler_NumberSelectsSession (0.00s)
PASS
ok  	github.com/tomas/ocwatch/internal/ui	0.325s
```

### All UI Tests Passing
- 10 total tests in ui package (including 2 new tests)
- All passing including new key handler tests
- No LSP errors detected
- Build succeeds: `go build ./cmd/ocwatch`

### Files Modified
- `internal/ui/ui.go`: Added key handlers in Update() method (lines 64-72)
- `internal/ui/ui_test.go`: Added 2 test functions (lines 74-136)

### Status
✅ Task complete - TDD approach followed, all tests passing, no errors, handlers implemented correctly

## Task 9: Panel Filtering Implementation

### Changes Made
1. **renderAgentTree()** - Modified to accept `sessionID` parameter
   - Now uses `GetFilteredAgentTree(sessionID)` instead of `GetAgentTree(sessionID)`
   - Empty sessionID shows "All Sessions" instead of "No session selected"
   - Displays all agents when no session is selected

2. **renderToolActivity()** - Modified to accept `sessionID` parameter
   - Now uses `GetFilteredToolCalls(sessionID)` instead of `GetRecentToolCalls()`
   - Filters tool calls by session when sessionID is provided
   - Shows all tool calls when sessionID is empty

3. **View() in ui.go** - Updated to pass selected session ID
   - Extracts `selectedSessionID` from `m.allSessions[m.selectedSessionIdx-1].ID`
   - Passes empty string when `selectedSessionIdx == 0` (show all)
   - Both renderAgentTree and renderToolActivity receive the same sessionID

4. **Stats Panel** - Verified to remain unfiltered
   - renderStats() signature unchanged (no sessionID parameter)
   - Continues to show global counts across all sessions

### Key Patterns
- Empty sessionID ("") triggers "show all" behavior in filter methods
- selectedSessionIdx uses 1-based indexing (0 = none/all, 1+ = specific session)
- Panel renderers now consistently filter by the same session selection

### Verification
- `go build ./cmd/ocwatch` succeeded
- No LSP diagnostics errors
- All panel renderers updated to use filtered data sources

## Task 10: Integration - Wire Up Session Discovery in main.go

### Changes Made
1. **main.go Session Loading** - Replaced single-project loading with multi-project discovery
   - Removed: `session.ListSessions(*projectDir)` (single project)
   - Added: `session.ListAllSessions(*dataDir)` (all projects)
   - Added: `session.FilterSessionsByToday(allSessions)` (filter to today)
   - Added: `appState.SetAllSessions(todaySessions)` (store in state)
   - Added: `uiModel.SetAllSessions(todaySessions)` (store in UI model)
   - Kept: Legacy `appState.AddSession(&s)` loop for backward compatibility

2. **UI Model Extension** - Added SetAllSessions method
   - Created `SetAllSessions(sessions []session.Session)` method on Model
   - Simple setter that updates `m.allSessions` field
   - Required because main.go needs to pass sessions to UI model

3. **--project Flag** - Preserved for plan tracking
   - Did NOT remove --project flag entirely
   - Still used for boulder/plan loading (lines 52-57)
   - Only removed its use for session loading

### Architecture Notes
- Session discovery now happens at startup via `ListAllSessions(*dataDir)`
- Data flows: main.go → State (via SetAllSessions) → UI Model (via SetAllSessions)
- Both State and UI Model maintain their own copy of allSessions
- State uses it for filtering, UI Model uses it for sidebar rendering

### Test Results
```
All tests pass: go test ./... -v
- internal/parser: 5 tests PASS
- internal/plan: 11 tests PASS
- internal/session: 17 tests PASS
- internal/state: 13 tests PASS
- internal/ui: 10 tests PASS
- internal/watcher: 10 tests PASS
Total: 66 tests, all passing
```

### Build Verification
```
go build ./cmd/ocwatch
Binary created: ocwatch (4.5M)
No build errors
```

### Files Modified
- `cmd/ocwatch/main.go`: Lines 42-52 (session loading logic)
- `internal/ui/ui.go`: Added SetAllSessions method (lines 42-44)

### Status
✅ Task complete - All tests passing, build successful, multi-project session discovery wired up

