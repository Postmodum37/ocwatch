# OCWatch - OpenCode Activity Monitor

## TL;DR

> **Quick Summary**: Build a Go TUI dashboard that monitors OpenCode's real-time activity by tailing log files. Shows which agents are running (including Prometheus in plan mode), model calls, plan progress, and provides sound notifications.
> 
> **Deliverables**:
> - `ocwatch` binary for macOS
> - Real-time agent monitoring with mode display (e.g., "prometheus mode=all")
> - Nested tree view of session → background tasks → subagents
> - Plan progress from .sisyphus/boulder.json
> - Tool call activity (metadata only)
> - Sound notifications for key events
> - Call count stats per model/provider
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (Parser) → Task 3 (State) → Task 5 (UI) → Task 8 (Main)

---

## Context

### Original Request
Build a Go TUI dashboard that monitors OpenCode's real-time activity, showing which agents are running and in what mode (like "Prometheus running in plan mode"). Should combine the best features of oh-my-opencode-dashboard while adding real-time agent mode visibility that the existing dashboard lacks.

### Interview Summary
**Key Discussions**:
- Stack: Go with bubbletea/lipgloss (matches OpenCode's stack)
- Layout: Dashboard style with multiple panels (like htop/k9s)
- Subagent display: Nested tree view showing hierarchy
- Cost tracking: Session totals (call counts per model/provider, no token estimation)
- Features: Plan progress, tool calls, sounds, multi-session
- Test strategy: TDD with Go tests
- Platform: macOS only for v1

**Research Findings**:
- Log format discovered: `INFO 2026-01-31T10:05:40 +1ms service=llm providerID=anthropic modelID=claude-opus-4-5 sessionID=ses_xxx agent=prometheus mode=all stream`
- Agents found: prometheus, sisyphus, Sisyphus-Junior, orchestrator-sisyphus, explore, metis, title
- Modes found: primary, subagent, all
- Data sources: `~/.local/share/opencode/log/YYYY-MM-DDTHHMMSS.log`, `~/.local/share/opencode/storage/{session,message,part}`
- oh-my-opencode-dashboard doesn't parse logs, so it can't show agent modes - this is our key differentiator

### Metis Review
**Identified Gaps** (addressed):
- Log file path pattern: Resolved - dated files in log directory
- Session lifecycle detection: Active = log activity within 5 minutes
- Sound events: All key events (agent state, user attention, plan progress)
- Memory limits: Ring buffer with 1000 entries
- Refresh rate: 250ms default
- Edge cases: Comprehensive handling defined in plan

---

## Work Objectives

### Core Objective
Create a terminal-based dashboard that provides real-time visibility into OpenCode's agent activity, specifically showing which agents are running and in what mode (e.g., "prometheus mode=all"), along with plan progress, tool activity, and session stats.

### Concrete Deliverables
- `cmd/ocwatch/main.go` - Entry point
- `internal/parser/parser.go` - Log line parser
- `internal/watcher/watcher.go` - Log file tail + rotation detection
- `internal/session/session.go` - Session storage reader
- `internal/plan/plan.go` - .sisyphus/boulder.json reader
- `internal/state/state.go` - Application state management
- `internal/ui/` - TUI components (panels, tree view, etc.)
- `internal/sound/sound.go` - Sound notification system

### Definition of Done
- [x] `go build ./cmd/ocwatch` succeeds
- [x] `go test ./...` passes all tests
- [x] Running `./ocwatch` shows real-time agent activity within 2 seconds of log entry
- [x] Agent mode is visible (e.g., "prometheus mode=all")
- [x] Nested tree view shows session → agents hierarchy
- [x] Plan progress shows current boulder status
- [x] Sounds play on key events (can be muted with 'm')

### Must Have
- Real-time log tailing with agent + mode extraction
- Multi-session support (show all active sessions)
- Nested agent tree view
- Plan progress from .sisyphus/boulder.json
- Tool call activity (name, status, timing - metadata only)
- Call counts per model/provider
- Sound notifications (all key events)
- Keybindings: q=quit, m=mute, ↑↓=scroll
- Graceful handling of missing files

### Must NOT Have (Guardrails)
- MUST NOT: Estimate tokens or calculate dollar costs
- MUST NOT: Add filtering, search, or query functionality
- MUST NOT: Add historical analysis or trend graphs
- MUST NOT: Add export functionality (CSV, JSON, etc.)
- MUST NOT: Add remote/network monitoring
- MUST NOT: Add theming or color customization
- MUST NOT: Create configuration UI or persist preferences
- MUST NOT: Modify any OpenCode files (read-only)
- MUST NOT: Control agents (start/stop/send messages)
- MUST NOT: Poll faster than 100ms (CPU safety)
- MUST NOT: Hold more than 1000 log entries in memory
- MUST NOT: Support Windows or Linux (macOS only for v1)
- MUST NOT: Support terminals smaller than 80x24

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (new project)
- **User wants tests**: TDD
- **Framework**: go test (standard library)

### Test Infrastructure Setup
Each TODO includes TDD workflow:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

### Manual Verification
For TUI components that can't be easily unit tested:
- Use `./ocwatch --data-dir=/tmp/mock-opencode` for testing with mock data
- Create mock log files and session storage
- Verify visual output against expected layout

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately) - Foundation:
├── Task 1: Log parser module
├── Task 2: Session storage reader
└── Task 4: Plan progress reader

Wave 2 (After Wave 1) - Core Systems:
├── Task 3: State management (depends: 1, 2, 4)
├── Task 6: Log watcher/tailer (depends: 1)
└── Task 7: Sound notifications (no dependencies but later priority)

Wave 3 (After Wave 2) - UI & Integration:
├── Task 5: TUI components (depends: 3)
└── Task 8: Main entry point (depends: all)

Critical Path: Task 1 → Task 3 → Task 5 → Task 8
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 (Parser) | None | 3, 6 | 2, 4 |
| 2 (Session) | None | 3 | 1, 4 |
| 3 (State) | 1, 2, 4 | 5 | 6, 7 |
| 4 (Plan) | None | 3 | 1, 2 |
| 5 (UI) | 3 | 8 | 6, 7 |
| 6 (Watcher) | 1 | 8 | 3, 7 |
| 7 (Sound) | None | 8 | 1, 2, 3, 4, 5, 6 |
| 8 (Main) | All | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 2, 4 | 3 parallel agents: quick category |
| 2 | 3, 6, 7 | 3 parallel agents: quick category |
| 3 | 5, 8 | Sequential: 5 first, then 8 |

---

## TODOs

### Task 0: Project Setup

- [x] 0. Initialize Go module and dependencies

  **What to do**:
  - Create go.mod with module name `github.com/tomas/ocwatch`
  - Add dependencies: bubbletea, lipgloss, fsnotify, nxadm/tail
  - Create directory structure: `cmd/ocwatch/`, `internal/{parser,watcher,session,plan,state,ui,sound}/`
  - Create placeholder files with package declarations

  **Must NOT do**:
  - Add unnecessary dependencies
  - Create complex abstractions before they're needed

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: Simple file creation and go mod init

  **Parallelization**:
  - **Can Run In Parallel**: NO (must complete first)
  - **Parallel Group**: Sequential - prerequisite for all
  - **Blocks**: All other tasks
  - **Blocked By**: None

  **References**:
  - Existing `PLAN.md:127-136` - Dependency list

  **Acceptance Criteria**:

  **TDD:**
  - [x] `go mod tidy` completes without errors
  - [x] `go build ./...` succeeds (empty packages)

  **Automated Verification:**
  ```bash
  # Agent runs:
  cd /Users/tomas/Workspace/ocwatch && go mod tidy && go build ./...
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `feat(init): initialize go module and project structure`
  - Files: `go.mod`, `go.sum`, `cmd/ocwatch/main.go`, `internal/*/`

---

### Task 1: Log Parser Module

- [x] 1. Create log line parser with TDD

  **What to do**:
  - Write tests first for parsing log lines
  - Parse format: `INFO  TIMESTAMP +Xms key=value key=value ...`
  - Extract: timestamp, service, providerID, modelID, sessionID, agent, mode
  - Handle malformed lines gracefully (return error, don't crash)
  - Support different log levels (INFO, ERROR, WARN, DEBUG)

  **Must NOT do**:
  - Over-engineer with complex parser generators
  - Support hypothetical future log formats
  - Add validation beyond basic parsing

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: Focused parsing task with clear input/output

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 4)
  - **Blocks**: Tasks 3, 6
  - **Blocked By**: Task 0

  **References**:
  - Log format example from research:
    ```
    INFO  2026-01-31T10:05:40 +1ms service=llm providerID=anthropic modelID=claude-opus-4-5 sessionID=ses_xxx agent=prometheus mode=all stream
    ```
  - `~/.local/share/opencode/log/2026-01-31T100513.log` - Real log samples

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `internal/parser/parser_test.go`
  - [x] Test cases: valid LLM entry, valid session entry, malformed line, empty line
  - [x] `go test ./internal/parser/...` → PASS (4+ tests)

  **Automated Verification:**
  ```bash
  # Agent runs:
  go test -v ./internal/parser/...
  # Assert: All tests pass
  # Assert: Output contains "PASS"
  ```

  **Commit**: YES
  - Message: `feat(parser): add log line parser with TDD`
  - Files: `internal/parser/parser.go`, `internal/parser/parser_test.go`
  - Pre-commit: `go test ./internal/parser/...`

---

### Task 2: Session Storage Reader

- [x] 2. Create session storage reader with TDD

  **What to do**:
  - Write tests first for reading session JSON files
  - Read from `~/.local/share/opencode/storage/session/{projectID}/`
  - Parse session JSON: id, slug, projectID, directory, title, time.created, time.updated
  - Support `XDG_DATA_HOME` with fallback to `~/.local/share`
  - List all sessions, filter by activity (updated within last N minutes)

  **Must NOT do**:
  - Read message or part storage (separate concern)
  - Cache sessions (stateless)
  - Add complex query capabilities

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: JSON file reading with clear structure

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 4)
  - **Blocks**: Task 3
  - **Blocked By**: Task 0

  **References**:
  - Session JSON structure from research:
    ```json
    {
      "id": "ses_xxx",
      "slug": "kind-comet",
      "projectID": "xxx",
      "directory": "/path/to/project",
      "title": "New session - 2026-01-31T10:05:39.301Z",
      "time": { "created": 1769853939301, "updated": 1769854012234 }
    }
    ```
  - Path: `~/.local/share/opencode/storage/session/{projectID}/{sessionID}.json`

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `internal/session/session_test.go`
  - [x] Test with mock session files in temp directory
  - [x] `go test ./internal/session/...` → PASS

  **Automated Verification:**
  ```bash
  # Agent runs:
  go test -v ./internal/session/...
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(session): add session storage reader with TDD`
  - Files: `internal/session/session.go`, `internal/session/session_test.go`
  - Pre-commit: `go test ./internal/session/...`

---

### Task 3: Application State Management

- [x] 3. Create centralized state management

  **What to do**:
  - Create State struct holding all application data
  - Track: active sessions, agent tree per session, model call counts, recent tool calls
  - Implement ring buffer for log entries (max 1000)
  - Thread-safe updates (mutex protection)
  - Methods: UpdateFromLogEntry, AddSession, GetAgentTree, GetCallCounts

  **Must NOT do**:
  - Add persistence
  - Add complex event sourcing
  - Over-engineer with channels when mutex suffices

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: Data structure design with thread safety

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential within wave)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 2, 4

  **References**:
  - Parser types from Task 1 (LogEntry struct)
  - Session types from Task 2 (Session struct)
  - Plan types from Task 4 (Boulder struct)

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `internal/state/state_test.go`
  - [x] Tests for: concurrent updates, ring buffer overflow, agent tree building
  - [x] `go test -race ./internal/state/...` → PASS

  **Automated Verification:**
  ```bash
  # Agent runs:
  go test -race -v ./internal/state/...
  # Assert: No race conditions
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(state): add centralized state management with TDD`
  - Files: `internal/state/state.go`, `internal/state/state_test.go`
  - Pre-commit: `go test -race ./internal/state/...`

---

### Task 4: Plan Progress Reader

- [x] 4. Create .sisyphus/boulder.json reader

  **What to do**:
  - Write tests first
  - Read `.sisyphus/boulder.json` from specified project directory
  - Parse: active_plan path, session_ids, status, progress
  - Read the active plan markdown file to extract task checkboxes
  - Calculate progress: completed/total tasks
  - Handle missing files gracefully (return "No active plan")

  **Must NOT do**:
  - Parse complex markdown beyond checkbox counting
  - Modify boulder.json or plan files
  - Add plan editing capabilities

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: JSON + simple markdown parsing

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 3
  - **Blocked By**: Task 0

  **References**:
  - `.sisyphus/boulder.json` structure (needs exploration)
  - Plan markdown format with checkboxes (incomplete and complete)

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `internal/plan/plan_test.go`
  - [x] Tests for: valid boulder, missing boulder, valid plan parsing, missing plan
  - [x] `go test ./internal/plan/...` → PASS

  **Automated Verification:**
  ```bash
  # Agent runs:
  go test -v ./internal/plan/...
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `feat(plan): add sisyphus plan progress reader with TDD`
  - Files: `internal/plan/plan.go`, `internal/plan/plan_test.go`
  - Pre-commit: `go test ./internal/plan/...`

---

### Task 5: TUI Components with Bubbletea

- [x] 5. Create dashboard TUI with bubbletea

  **What to do**:
  - Create main Model implementing tea.Model interface
  - Implement panels:
    - Header: Current time, app name, connection status
    - Sessions panel: List all active sessions (scrollable)
    - Agent tree panel: Nested view of agents per session
    - Tool activity panel: Last 10 tool calls
    - Stats panel: Call counts per model
    - Plan progress panel: Current boulder status
    - Status bar: Keybindings help
  - Implement keybindings: q=quit, m=mute, ↑↓=scroll, Tab=switch panels
  - Use lipgloss for styling (colors, borders, layout)
  - Handle terminal resize events

  **Must NOT do**:
  - Add complex navigation beyond basic scrolling
  - Add input fields or editing capabilities
  - Add custom color themes

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `["frontend-ui-ux"]`
  - Reason: TUI design requires visual thinking for layout and UX

  **Parallelization**:
  - **Can Run In Parallel**: NO (after Wave 2)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 8
  - **Blocked By**: Task 3

  **References**:
  - PLAN.md UI mockup (lines 25-42)
  - bubbletea examples: https://github.com/charmbracelet/bubbletea/tree/master/examples
  - lipgloss examples: https://github.com/charmbracelet/lipgloss/tree/master/examples
  - State struct from Task 3 (data to display)

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `internal/ui/ui_test.go`
  - [x] Tests for: Model.Init, Model.Update (key events), View rendering

  **Automated Verification:**
  ```bash
  # Agent runs:
  go test -v ./internal/ui/...
  # Assert: Tests pass

  # Visual verification (manual but documented):
  # Create test binary with mock data
  go build -o /tmp/ocwatch-test ./cmd/ocwatch
  # Run with mock data dir containing sample session/log files
  # Expected: Dashboard renders with all panels visible
  ```

  **Commit**: YES
  - Message: `feat(ui): add bubbletea dashboard with all panels`
  - Files: `internal/ui/ui.go`, `internal/ui/styles.go`, `internal/ui/panels.go`, `internal/ui/ui_test.go`
  - Pre-commit: `go test ./internal/ui/...`

---

### Task 6: Log File Watcher

- [x] 6. Create log file watcher with tail and rotation detection

  **What to do**:
  - Watch `~/.local/share/opencode/log/` directory for new files
  - Find and tail the most recent log file
  - Detect when new log file is created (rotation) and switch to it
  - Parse each new line using parser from Task 1
  - Send parsed entries to a channel
  - Handle file not existing (wait for it)

  **Must NOT do**:
  - Read entire log file on startup (only tail new entries)
  - Poll faster than 100ms
  - Hold file handles after rotation

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: File watching is well-documented with fsnotify

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:
  - Parser from Task 1 (ParseLine function)
  - Log directory: `~/.local/share/opencode/log/`
  - File naming: `YYYY-MM-DDTHHMMSS.log`
  - fsnotify docs: https://github.com/fsnotify/fsnotify
  - nxadm/tail docs: https://github.com/nxadm/tail

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `internal/watcher/watcher_test.go`
  - [x] Tests for: find latest file, tail new lines, detect new file

  **Automated Verification:**
  ```bash
  # Agent runs:
  go test -v ./internal/watcher/...
  # Assert: Tests pass

  # Integration test:
  # Create temp log file, start watcher, append line, verify received
  ```

  **Commit**: YES
  - Message: `feat(watcher): add log file watcher with rotation detection`
  - Files: `internal/watcher/watcher.go`, `internal/watcher/watcher_test.go`
  - Pre-commit: `go test ./internal/watcher/...`

---

### Task 7: Sound Notifications

- [x] 7. Create sound notification system

  **What to do**:
  - Implement sound playback for macOS (using afplay or CoreAudio)
  - Define sound events:
    - `AgentStarted`: New agent began working
    - `AgentCompleted`: Agent finished (success)
    - `AgentError`: Agent encountered error
    - `QuestionWaiting`: User input needed
    - `TaskCompleted`: Plan task marked done
    - `PlanFinished`: Entire plan completed
  - Support mute toggle (state flag)
  - Embed simple audio files or use system sounds
  - Non-blocking playback (goroutine)

  **Must NOT do**:
  - Add sound customization
  - Add volume control
  - Support other platforms

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: macOS audio is straightforward with afplay

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 6)
  - **Blocks**: Task 8
  - **Blocked By**: None (can start immediately, but lower priority)

  **References**:
  - macOS afplay: `/usr/bin/afplay` for audio playback
  - System sounds: `/System/Library/Sounds/`

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `internal/sound/sound_test.go`
  - [x] Tests for: mute toggle, event dispatch (mock audio)

  **Automated Verification:**
  ```bash
  # Agent runs:
  go test -v ./internal/sound/...
  # Assert: Tests pass

  # Manual: Run with sound enabled, verify audio plays
  ```

  **Commit**: YES
  - Message: `feat(sound): add sound notification system for macOS`
  - Files: `internal/sound/sound.go`, `internal/sound/sound_test.go`
  - Pre-commit: `go test ./internal/sound/...`

---

### Task 8: Main Entry Point and Integration

- [x] 8. Create main entry point integrating all components

  **What to do**:
  - Parse command-line flags: `--data-dir`, `--project`
  - Initialize all components: watcher, session reader, plan reader, state, UI, sound
  - Wire up: watcher → state updates → UI refresh
  - Handle graceful shutdown (SIGINT, SIGTERM)
  - Handle errors: missing data dir, permission denied, etc.
  - Run bubbletea program with alt screen

  **Must NOT do**:
  - Add complex CLI framework (just flag package)
  - Add daemon mode
  - Add configuration file support

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: Wiring components is straightforward

  **Parallelization**:
  - **Can Run In Parallel**: NO (final task)
  - **Parallel Group**: Wave 3 (after Task 5)
  - **Blocks**: None (final)
  - **Blocked By**: All other tasks

  **References**:
  - All internal packages from Tasks 1-7
  - bubbletea tea.NewProgram, tea.WithAltScreen

  **Acceptance Criteria**:

  **TDD:**
  - [x] `go build ./cmd/ocwatch` → succeeds
  - [x] `./ocwatch --help` → shows usage

  **Automated Verification:**
  ```bash
  # Agent runs:
  go build -o /tmp/ocwatch ./cmd/ocwatch
  /tmp/ocwatch --help
  # Assert: Exit code 0
  # Assert: Output contains "--data-dir" and "--project"
  ```

  **Manual Verification (TUI):**
  ```bash
  # Run with real OpenCode data:
  /tmp/ocwatch
  # Expected:
  # 1. Dashboard appears within 2 seconds
  # 2. Shows sessions from ~/.local/share/opencode/storage/session/
  # 3. New log entries appear in agent tree within 500ms
  # 4. 'q' quits cleanly
  # 5. 'm' toggles mute indicator
  ```

  **Commit**: YES
  - Message: `feat(main): integrate all components into ocwatch binary`
  - Files: `cmd/ocwatch/main.go`
  - Pre-commit: `go test ./... && go build ./cmd/ocwatch`

---

### Task 9: Documentation and README

- [x] 9. Create README and documentation

  **What to do**:
  - Write README.md with:
    - Description and screenshot placeholder
    - Installation: `go install github.com/tomas/ocwatch@latest`
    - Usage: `ocwatch [--project /path] [--data-dir /path]`
    - Keybindings table
    - Requirements (macOS, OpenCode)
  - Add inline code comments for complex logic
  - Create ARCHITECTURE.md if needed

  **Must NOT do**:
  - Create excessive documentation
  - Add changelogs before first release
  - Add contribution guidelines

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]`
  - Reason: Documentation task

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 8)
  - **Parallel Group**: Post-integration
  - **Blocks**: None
  - **Blocked By**: Task 8

  **References**:
  - oh-my-opencode-dashboard README for format inspiration

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Agent runs:
  test -f README.md && head -20 README.md
  # Assert: File exists
  # Assert: Contains "# OCWatch"
  # Assert: Contains "Installation"
  ```

  **Commit**: YES
  - Message: `docs: add README and usage documentation`
  - Files: `README.md`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 0 | `feat(init): initialize go module and project structure` | go.mod, go.sum, cmd/, internal/ | `go build ./...` |
| 1 | `feat(parser): add log line parser with TDD` | internal/parser/* | `go test ./internal/parser/...` |
| 2 | `feat(session): add session storage reader with TDD` | internal/session/* | `go test ./internal/session/...` |
| 3 | `feat(state): add centralized state management with TDD` | internal/state/* | `go test -race ./internal/state/...` |
| 4 | `feat(plan): add sisyphus plan progress reader with TDD` | internal/plan/* | `go test ./internal/plan/...` |
| 5 | `feat(ui): add bubbletea dashboard with all panels` | internal/ui/* | `go test ./internal/ui/...` |
| 6 | `feat(watcher): add log file watcher with rotation detection` | internal/watcher/* | `go test ./internal/watcher/...` |
| 7 | `feat(sound): add sound notification system for macOS` | internal/sound/* | `go test ./internal/sound/...` |
| 8 | `feat(main): integrate all components into ocwatch binary` | cmd/ocwatch/main.go | `go test ./... && go build ./cmd/ocwatch` |
| 9 | `docs: add README and usage documentation` | README.md | `test -f README.md` |

---

## Success Criteria

### Verification Commands
```bash
# Build
go build ./cmd/ocwatch
# Expected: Binary created without errors

# Tests
go test ./...
# Expected: All tests pass

# Run
./ocwatch
# Expected: Dashboard appears, shows current OpenCode sessions

# Live test (run alongside OpenCode)
# In terminal 1: ./ocwatch
# In terminal 2: Start OpenCode, trigger agent activity
# Expected: ocwatch shows agent activity in real-time with mode visible
```

### Final Checklist
- [x] All "Must Have" features present and working
- [x] All "Must NOT Have" items absent
- [x] All tests pass with `go test ./...`
- [x] Binary builds cleanly with `go build ./cmd/ocwatch`
- [x] Dashboard shows real-time agent activity with mode
- [x] Sound notifications work and can be muted
- [x] Graceful handling of missing files/data
- [x] README documents installation and usage
