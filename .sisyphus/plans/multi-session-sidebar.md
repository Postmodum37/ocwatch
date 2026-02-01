# Multi-Session Tracking with Sidebar

## TL;DR

> **Quick Summary**: Add cross-project OpenCode session discovery with a left sidebar for viewing all active sessions, number key selection (0-9), and session-based filtering of main panels. Also remove the sound module.
> 
> **Deliverables**: 
> - Multi-project session discovery (scan all projects, not just one)
> - Left sidebar showing all sessions from today with project name
> - Number keys 1-9 to select session, 0 to clear filter
> - Main panels filtered by selected session
> - Sound module completely removed
> 
> **Estimated Effort**: Medium (8-12 tasks, ~4-6 hours)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (sound removal) → Task 2 (session discovery) → Task 5 (state) → Task 7 (sidebar UI) → Task 9 (filtering)

---

## Context

### Original Request
User reported that OCWatch doesn't track other running OpenCode sessions (e.g., one running in /Users/tomas/Workspace/addon-radar isn't visible). Requested:
1. Track ALL running OpenCode sessions across projects
2. Sidebar to see active sessions and switch between them
3. Remove sound module (not needed)

### Interview Summary
**Key Discussions**:
- **Session switching behavior**: Filter main panels to show only selected session's data
- **Session visibility**: All sessions from today (even if currently idle)
- **Sidebar position**: Left side (standard)
- **Keyboard navigation**: Number keys 1-9 for quick selection
- **Test strategy**: TDD (tests first)

**Research Findings**:
- Root cause: Current implementation only loads sessions for ONE project via `--project` flag
- OpenCode stores projects in `~/.local/share/opencode/storage/project/{hash}.json` with `worktree` field
- Sessions stored per-project in `~/.local/share/opencode/storage/session/{projectID}/`
- 2 OpenCode processes currently running (addon-radar, ocwatch)
- `ToolCall` struct is missing `SessionID` field - needed for filtering

### Metis Review
**Identified Gaps** (addressed):
- Key 0 should clear filter (show all sessions) → Added to spec
- `global.json` project should be excluded → Added guard
- ToolCall struct needs SessionID for filtering to work → Added to Task 5
- Sidebar width should be fixed (not percentage) → Set to 28 chars
- Stats panel should NOT filter (global counts useful) → Clarified in filtering task
- "Today" defined as >= midnight local time → Clarified

---

## Work Objectives

### Core Objective
Enable OCWatch to discover and display ALL OpenCode sessions across ALL projects, with a sidebar for session selection and filtering.

### Concrete Deliverables
- `internal/session/project.go`: New file with `ListAllProjects()` and `ListAllSessions()`
- `internal/ui/sidebar.go`: New file with `renderSidebar()` function
- `internal/state/state.go`: Add `SessionID` to `ToolCall`, add filtering methods
- `internal/ui/ui.go`: Horizontal layout with sidebar, number key handlers
- `internal/ui/panels.go`: Filter parameters added to panel functions
- `internal/sound/` directory: DELETED
- `cmd/ocwatch/main.go`: Sound imports and usage removed

### Definition of Done
- [x] `go test ./...` passes (all tests green)
- [x] `go build ./cmd/ocwatch` succeeds with no errors
- [x] `grep -r "sound" --include="*.go" . | wc -l` returns 0 (sound fully removed)
- [x] Running `./ocwatch` shows sidebar with sessions from multiple projects
- [x] Pressing 1-9 filters panels, pressing 0 shows all

### Must Have
- Multi-project session discovery
- Left sidebar with project names and session info
- Number key (0-9) navigation
- Session filtering on Agent Tree, Tool Activity, Recent Logs panels
- Sound module completely removed
- TDD: Tests written before implementation

### Must NOT Have (Guardrails)
- Session search/filter text input (out of scope)
- Session grouping by project (flat list sorted by time)
- Session creation/deletion functionality
- Keyboard shortcuts beyond 0-9 (no vim j/k)
- Persistent session preference (always start with "all")
- Refactoring existing panel signatures (only add filter param)
- Project watching/live reload (scan once at startup)
- Include `global.json` project (exclude it)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (existing `*_test.go` files)
- **User wants tests**: TDD (tests first)
- **Framework**: Go standard `testing` package

### TDD Structure

Each task follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

### Test Commands
```bash
# Run all tests
go test ./... -v

# Run specific package tests
go test ./internal/session -v
go test ./internal/state -v
go test ./internal/ui -v

# Build verification
go build ./cmd/ocwatch
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Remove sound module (independent)
└── Task 2: Multi-project discovery (session package)

Wave 2 (After Wave 1):
├── Task 3: ListAllSessions implementation
├── Task 4: Session filtering by "today"
└── Task 5: State modifications (ToolCall.SessionID, filter methods)

Wave 3 (After Wave 2):
├── Task 6: Sidebar rendering
├── Task 7: Horizontal layout + sidebar integration
├── Task 8: Number key handlers (0-9)
└── Task 9: Panel filtering by selected session

Wave 4 (Final):
└── Task 10: Integration test and cleanup
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | None | 2 |
| 2 | None | 3, 4 | 1 |
| 3 | 2 | 5, 6 | 4 |
| 4 | 2 | 5 | 3 |
| 5 | 3, 4 | 8, 9 | None |
| 6 | 3 | 7 | 5 |
| 7 | 6 | 8, 9 | None |
| 8 | 5, 7 | 10 | 9 |
| 9 | 5, 7 | 10 | 8 |
| 10 | 8, 9 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 2 | `delegate_task(category="quick", run_in_background=true)` |
| 2 | 3, 4, 5 | `delegate_task(category="unspecified-low", run_in_background=true)` |
| 3 | 6, 7, 8, 9 | Sequential due to UI dependencies |
| 4 | 10 | Final integration |

---

## TODOs

### Task 1: Remove Sound Module

- [x] 1. Remove sound module completely

  **What to do**:
  - Delete `internal/sound/sound.go` file
  - Delete `internal/sound/sound_test.go` file
  - Delete `internal/sound/` directory
  - Remove import `"github.com/tomas/ocwatch/internal/sound"` from `cmd/ocwatch/main.go`
  - Remove `soundMgr := sound.NewSoundManager()` line from main.go
  - Remove `soundMgr.Play(sound.AgentStarted)` call from main.go
  - Remove `muted bool` field from `internal/ui/ui.go` Model struct
  - Remove `case "m": m.muted = !m.muted` handler from ui.go
  - Update status bar help text in `internal/ui/panels.go` from `"q:quit │ m:mute │ ↑↓:scroll │ Tab:switch"` to `"q:quit │ ↑↓:scroll │ Tab:switch │ 0-9:session"`
  - Update README.md to remove sound-related documentation

  **Must NOT do**:
  - Replace with alternative notification system
  - Add any other audio functionality

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward deletion and line removal, no complex logic
  - **Skills**: `[]`
    - No special skills needed for file deletion

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `internal/sound/sound.go` - File to delete entirely
  - `internal/sound/sound_test.go` - File to delete entirely
  - `cmd/ocwatch/main.go:14` - Import to remove: `"github.com/tomas/ocwatch/internal/sound"`
  - `cmd/ocwatch/main.go:41` - Line to remove: `soundMgr := sound.NewSoundManager()`
  - `cmd/ocwatch/main.go:77` - Line to remove: `soundMgr.Play(sound.AgentStarted)`
  - `internal/ui/ui.go:27` - Field to remove: `muted bool`
  - `internal/ui/ui.go:52-53` - Case to remove: `case "m": m.muted = !m.muted`
  - `internal/ui/panels.go:222` - Help text to update

  **Acceptance Criteria**:
  - [x] `rm -rf internal/sound` succeeds
  - [x] `go build ./cmd/ocwatch` succeeds (no import errors)
  - [x] `grep -r "sound" --include="*.go" . | grep -v "_test" | wc -l` outputs `0`
  - [x] `grep -r "muted" --include="*.go" internal/ui/ | wc -l` outputs `0`
  - [x] `./ocwatch --help` shows no sound-related options

  **Commit**: YES
  - Message: `chore: remove sound notification module`
  - Files: `internal/sound/*, cmd/ocwatch/main.go, internal/ui/ui.go, internal/ui/panels.go, README.md`
  - Pre-commit: `go build ./cmd/ocwatch`

---

### Task 2: Add ListAllProjects Function

- [x] 2. Create project discovery with tests (TDD)

  **What to do**:
  - Create new file `internal/session/project.go`
  - Write test first in `internal/session/project_test.go`:
    - `TestListAllProjects_ReturnsMultipleProjects`
    - `TestListAllProjects_ExcludesGlobalProject`
    - `TestListAllProjects_HandlesEmptyDirectory`
  - Implement `Project` struct with fields: `ID`, `Worktree`, `Created`, `Updated`
  - Implement `ListAllProjects(storagePath string) ([]Project, error)`
  - Scan `{storagePath}/opencode/storage/project/*.json`
  - Parse JSON, extract `worktree` field
  - Exclude entries where `worktree == "/"` (global.json)
  - Return list sorted by `Updated` desc

  **Must NOT do**:
  - Add project watching/auto-refresh
  - Add project creation functionality

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Straightforward file I/O and JSON parsing
  - **Skills**: `[]`
    - Standard Go patterns, no special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: None

  **References**:
  - `internal/session/session.go:33-44` - `getStoragePath()` function to reuse for path resolution
  - `internal/session/session.go:50-74` - Pattern for reading directory and parsing JSON files
  - `~/.local/share/opencode/storage/project/386043c27ba886538edc95090a732275ede2d4db.json` - Example project JSON structure: `{"id":"...","worktree":"/path","vcs":"git","time":{"created":ms,"updated":ms}}`

  **Acceptance Criteria**:
  - [x] Test file exists: `ls internal/session/project_test.go`
  - [x] Tests pass: `go test ./internal/session -run TestListAllProjects -v` exits 0
  - [x] Returns multiple projects:
    ```bash
    go test ./internal/session -run TestListAllProjects_ReturnsMultiple -v 2>&1 | grep -q "PASS"
    ```
  - [x] Excludes global.json:
    ```bash
    go test ./internal/session -run TestListAllProjects_ExcludesGlobal -v 2>&1 | grep -q "PASS"
    ```

  **Commit**: YES
  - Message: `feat(session): add ListAllProjects for multi-project discovery`
  - Files: `internal/session/project.go, internal/session/project_test.go`
  - Pre-commit: `go test ./internal/session -v`

---

### Task 3: Add ListAllSessions Function

- [x] 3. Implement ListAllSessions across all projects (TDD)

  **What to do**:
  - Write test first in `internal/session/project_test.go`:
    - `TestListAllSessions_ReturnsSessionsFromMultipleProjects`
    - `TestListAllSessions_IncludesProjectInfo`
  - Add `ProjectWorktree` field to `Session` struct to track which project a session belongs to
  - Implement `ListAllSessions(storagePath string) ([]Session, error)`
  - Call `ListAllProjects()` to get all projects
  - For each project, call `ListSessionsWithPath(storagePath, project.ID)`
  - Populate `ProjectWorktree` field from project info
  - Combine all sessions into single slice
  - Sort by `Updated` desc

  **Must NOT do**:
  - Add session creation/deletion
  - Add complex filtering logic here (that's Task 4)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Composition of existing functions
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: Task 2

  **References**:
  - `internal/session/session.go:11-19` - Session struct to extend with `ProjectWorktree string`
  - `internal/session/session.go:50-74` - `ListSessionsWithPath()` to call for each project
  - `internal/session/project.go` - `ListAllProjects()` created in Task 2

  **Acceptance Criteria**:
  - [x] Session struct has ProjectWorktree field:
    ```bash
    grep -q "ProjectWorktree" internal/session/session.go && echo "PASS"
    ```
  - [x] Tests pass: `go test ./internal/session -run TestListAllSessions -v` exits 0
  - [x] Function exists and is callable:
    ```bash
    grep -q "func ListAllSessions" internal/session/project.go && echo "PASS"
    ```

  **Commit**: YES
  - Message: `feat(session): add ListAllSessions for cross-project session discovery`
  - Files: `internal/session/session.go, internal/session/project.go, internal/session/project_test.go`
  - Pre-commit: `go test ./internal/session -v`

---

### Task 4: Add FilterSessionsByToday Function

- [x] 4. Implement session filtering by "today" (TDD)

  **What to do**:
  - Write test first:
    - `TestFilterSessionsByToday_IncludesTodaySessions`
    - `TestFilterSessionsByToday_ExcludesYesterdaySessions`
  - Implement `FilterSessionsByToday(sessions []Session) []Session`
  - "Today" = sessions where `Updated >= midnight local time`
  - Use `time.Now().Truncate(24 * time.Hour)` for midnight calculation

  **Must NOT do**:
  - Add complex date range filtering
  - Add timezone configuration

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple time comparison logic
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 5)
  - **Blocks**: Task 5
  - **Blocked By**: Task 2

  **References**:
  - `internal/session/session.go:104-119` - `FilterActiveSessions()` as pattern for filtering
  - Go time package: `time.Now().Truncate(24 * time.Hour)` for midnight

  **Acceptance Criteria**:
  - [x] Tests pass: `go test ./internal/session -run TestFilterSessionsByToday -v` exits 0
  - [x] Function filters correctly:
    ```bash
    grep -q "func FilterSessionsByToday" internal/session/session.go && echo "PASS"
    ```

  **Commit**: YES (groups with Task 3)
  - Message: `feat(session): add FilterSessionsByToday for daily session filtering`
  - Files: `internal/session/session.go, internal/session/session_test.go`
  - Pre-commit: `go test ./internal/session -v`

---

### Task 5: State Modifications for Session Filtering

- [x] 5. Add SessionID to ToolCall and filtering methods (TDD)

  **What to do**:
  - Write tests first:
    - `TestToolCallHasSessionID`
    - `TestGetAgentTreeFiltered`
    - `TestGetRecentToolCallsFiltered`
  - Add `SessionID string` field to `ToolCall` struct
  - Add `allSessions []session.Session` field to store all discovered sessions
  - Add `selectedSessionID string` field to track current selection (empty = all)
  - Add method `SetAllSessions(sessions []session.Session)`
  - Add method `SetSelectedSession(sessionID string)` 
  - Add method `GetSelectedSession() string`
  - Add method `GetFilteredAgentTree(sessionID string) []AgentInfo`
  - Add method `GetFilteredToolCalls(sessionID string) []*ToolCall`
  - When sessionID is empty, return all data (no filter)

  **Must NOT do**:
  - Add persistent session preference
  - Add complex filtering expressions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: State management with thread-safety considerations
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Tasks 3, 4)
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: Tasks 3, 4

  **References**:
  - `internal/state/state.go:17-22` - Current `ToolCall` struct to extend
  - `internal/state/state.go:75-94` - Current `State` struct to extend
  - `internal/state/state.go:194-203` - `GetAgentTree()` as pattern for filtered version
  - `internal/state/state.go:179-191` - `GetRecentToolCalls()` as pattern for filtered version

  **Acceptance Criteria**:
  - [x] ToolCall has SessionID:
    ```bash
    grep -q "SessionID.*string" internal/state/state.go && echo "PASS"
    ```
  - [x] Tests pass: `go test ./internal/state -run TestToolCall -v` exits 0
  - [x] Tests pass: `go test ./internal/state -run TestGetFiltered -v` exits 0
  - [x] Filtered methods exist:
    ```bash
    grep -q "GetFilteredAgentTree" internal/state/state.go && \
    grep -q "GetFilteredToolCalls" internal/state/state.go && echo "PASS"
    ```

  **Commit**: YES
  - Message: `feat(state): add session filtering support to ToolCall and State`
  - Files: `internal/state/state.go, internal/state/state_test.go`
  - Pre-commit: `go test ./internal/state -v`

---

### Task 6: Create Sidebar Rendering Function

- [x] 6. Implement renderSidebar function (TDD)

  **What to do**:
  - Create new file `internal/ui/sidebar.go`
  - Write test first in `internal/ui/sidebar_test.go`:
    - `TestRenderSidebar_ShowsProjectName`
    - `TestRenderSidebar_ShowsSessionNumbers`
    - `TestRenderSidebar_HighlightsSelected`
    - `TestRenderSidebar_FixedWidth`
  - Implement `renderSidebar(styles Styles, sessions []session.Session, selectedIdx int, height int) string`
  - Fixed width: 28 characters
  - Show numbered list: `1. project-name`
  - Extract project name from `ProjectWorktree` (last path component)
  - Show session title/slug below project name (truncated)
  - Highlight selected session with different style
  - Handle >9 sessions: show all but only 1-9 have numbers

  **Must NOT do**:
  - Add search/filter input
  - Add collapsible/resizable sidebar
  - Group by project

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI rendering with styling
  - **Skills**: `["frontend-ui-ux"]`
    - UI component design

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 7
  - **Blocked By**: Task 3

  **References**:
  - `internal/ui/panels.go:42-111` - `renderSessions()` as pattern for list rendering
  - `internal/ui/styles.go` - Styles struct for consistent styling
  - `internal/session/session.go:11-19` - Session struct with `ProjectWorktree` field

  **Acceptance Criteria**:
  - [x] File exists: `ls internal/ui/sidebar.go`
  - [x] Test file exists: `ls internal/ui/sidebar_test.go`
  - [x] Tests pass: `go test ./internal/ui -run TestRenderSidebar -v` exits 0
  - [x] Width is fixed at 28:
    ```bash
    grep -q "28" internal/ui/sidebar.go && echo "PASS"
    ```

  **Commit**: YES
  - Message: `feat(ui): add sidebar rendering for session list`
  - Files: `internal/ui/sidebar.go, internal/ui/sidebar_test.go`
  - Pre-commit: `go test ./internal/ui -v`

---

### Task 7: Integrate Sidebar with Horizontal Layout

- [x] 7. Modify View() for horizontal layout with sidebar

  **What to do**:
  - Add to Model struct:
    - `allSessions []session.Session` - all discovered sessions
    - `selectedSessionIdx int` - currently selected (0 = none/all, 1-9 = index)
  - Modify `View()` method:
    - Use `lipgloss.JoinHorizontal()` for main layout
    - Left: Sidebar (fixed 28 chars)
    - Right: Existing vertical panel stack (remaining width)
  - Calculate sidebar height (full terminal height minus status bar)
  - If terminal width < 60, hide sidebar and show warning

  **Must NOT do**:
  - Add dynamic/resizable sidebar
  - Add sidebar toggle

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Layout composition
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 6)
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: Task 6

  **References**:
  - `internal/ui/ui.go:15-29` - Model struct to extend
  - `internal/ui/ui.go:85-156` - `View()` method to modify
  - `internal/ui/ui.go:146-155` - Current `JoinVertical()` composition to wrap in `JoinHorizontal()`

  **Acceptance Criteria**:
  - [x] Model has new fields:
    ```bash
    grep -q "allSessions" internal/ui/ui.go && \
    grep -q "selectedSessionIdx" internal/ui/ui.go && echo "PASS"
    ```
  - [x] View uses horizontal join:
    ```bash
    grep -q "JoinHorizontal" internal/ui/ui.go && echo "PASS"
    ```
  - [x] Build succeeds: `go build ./cmd/ocwatch` exits 0

  **Commit**: YES
  - Message: `feat(ui): integrate sidebar with horizontal layout`
  - Files: `internal/ui/ui.go`
  - Pre-commit: `go build ./cmd/ocwatch`

---

### Task 8: Add Number Key Handlers (0-9)

- [x] 8. Implement keyboard handlers for session selection

  **What to do**:
  - Write test first:
    - `TestKeyHandler_NumberSelectsSession`
    - `TestKeyHandler_ZeroClearsSelection`
  - Add key handlers in `Update()` method for keys "0" through "9"
  - Key "0": Clear selection (`selectedSessionIdx = 0`, shows all)
  - Keys "1"-"9": Set `selectedSessionIdx` to that number if valid session exists
  - If key > number of sessions, ignore
  - Update state's selected session ID when selection changes

  **Must NOT do**:
  - Add vim-style j/k navigation
  - Add arrow key navigation for sidebar

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple key handling logic
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 9)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 5, 7

  **References**:
  - `internal/ui/ui.go:45-83` - `Update()` method, add cases near line 48-63

  **Acceptance Criteria**:
  - [x] Tests pass: `go test ./internal/ui -run TestKeyHandler -v` exits 0
  - [x] Key handlers exist:
    ```bash
    grep -q 'case "0"' internal/ui/ui.go && \
    grep -q 'case "1"' internal/ui/ui.go && echo "PASS"
    ```

  **Commit**: YES (groups with Task 9)
  - Message: `feat(ui): add number key handlers for session selection`
  - Files: `internal/ui/ui.go, internal/ui/ui_test.go`
  - Pre-commit: `go test ./internal/ui -v`

---

### Task 9: Add Panel Filtering by Selected Session

- [x] 9. Modify panel rendering to filter by selected session

  **What to do**:
  - Modify `renderAgentTree()` signature to accept optional sessionID filter
  - Modify `renderToolActivity()` to filter tool calls by sessionID
  - Modify `renderSessions()` to highlight selected session
  - In `View()`, pass selected session ID to panel renderers
  - Stats panel: Do NOT filter (keep showing global counts)
  - When no session selected (0), show all data

  **Must NOT do**:
  - Filter stats panel
  - Add complex filter expressions

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Parameter threading through functions
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 5, 7

  **References**:
  - `internal/ui/panels.go:113-145` - `renderAgentTree()` to modify
  - `internal/ui/panels.go:147-169` - `renderToolActivity()` to modify
  - `internal/state/state.go` - `GetFilteredAgentTree()`, `GetFilteredToolCalls()` from Task 5

  **Acceptance Criteria**:
  - [x] Build succeeds: `go build ./cmd/ocwatch` exits 0
  - [x] Functions accept filter parameter:
    ```bash
    grep -q "sessionID string" internal/ui/panels.go && echo "PASS"
    ```

  **Commit**: YES (groups with Task 8)
  - Message: `feat(ui): add session filtering to panel rendering`
  - Files: `internal/ui/panels.go, internal/ui/ui.go`
  - Pre-commit: `go build ./cmd/ocwatch`

---

### Task 10: Integration Test and Main.go Updates

- [x] 10. Wire up session discovery in main.go and test

  **What to do**:
  - Modify `cmd/ocwatch/main.go`:
    - Remove `--project` flag handling for session loading (keep for plan tracking)
    - Call `session.ListAllSessions()` instead of `session.ListSessions(projectID)`
    - Call `session.FilterSessionsByToday()` on results
    - Pass sessions to UI Model
  - Run full integration test:
    - Build and run ocwatch
    - Verify sidebar shows sessions from multiple projects
    - Verify number keys work
    - Verify filtering works

  **Must NOT do**:
  - Remove --project flag entirely (still needed for plan tracking)
  - Add new command line flags

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Wiring and integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None
  - **Blocked By**: Tasks 8, 9

  **References**:
  - `cmd/ocwatch/main.go:44-52` - Current session loading logic to replace
  - `internal/session/project.go` - `ListAllSessions()` from Task 3
  - `internal/session/session.go` - `FilterSessionsByToday()` from Task 4

  **Acceptance Criteria**:
  - [x] All tests pass: `go test ./... -v` exits 0
  - [x] Build succeeds: `go build ./cmd/ocwatch` exits 0
  - [x] Manual verification via TUI:
    ```bash
    # Start ocwatch and verify visually
    ./ocwatch &
    sleep 2
    # Kill after verification
    kill %1
    ```

  **Commit**: YES
  - Message: `feat: wire up multi-project session discovery in main`
  - Files: `cmd/ocwatch/main.go`
  - Pre-commit: `go test ./... && go build ./cmd/ocwatch`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `chore: remove sound notification module` | internal/sound/*, main.go, ui.go, panels.go, README.md | `go build ./cmd/ocwatch` |
| 2 | `feat(session): add ListAllProjects` | session/project.go, project_test.go | `go test ./internal/session` |
| 3+4 | `feat(session): add ListAllSessions and FilterSessionsByToday` | session/*.go | `go test ./internal/session` |
| 5 | `feat(state): add session filtering support` | state/state.go, state_test.go | `go test ./internal/state` |
| 6 | `feat(ui): add sidebar rendering` | ui/sidebar.go, sidebar_test.go | `go test ./internal/ui` |
| 7 | `feat(ui): integrate sidebar with horizontal layout` | ui/ui.go | `go build` |
| 8+9 | `feat(ui): add session selection and panel filtering` | ui/ui.go, ui_test.go, panels.go | `go test ./internal/ui` |
| 10 | `feat: wire up multi-project session discovery` | main.go | `go test ./... && go build` |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
go test ./... -v
# Expected: PASS for all packages

# Build succeeds
go build ./cmd/ocwatch
# Expected: No errors, binary created

# Sound completely removed
grep -r "sound" --include="*.go" . | wc -l
# Expected: 0

# New functions exist
grep -l "ListAllProjects\|ListAllSessions\|FilterSessionsByToday" internal/session/*.go
# Expected: Lists project.go and session.go

# Sidebar function exists
grep -l "renderSidebar" internal/ui/*.go
# Expected: Lists sidebar.go
```

### Final Checklist
- [x] All "Must Have" features present
- [x] All "Must NOT Have" guardrails respected
- [x] All tests pass
- [x] Build succeeds
- [x] Sound module completely removed
- [x] Sidebar shows sessions from multiple projects
- [x] Number keys 0-9 work for selection
- [x] Panels filter by selected session
