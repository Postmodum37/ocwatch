# OCWatch Bug Fixes and Improvements

## TL;DR

> **Quick Summary**: Fix 20 verified bugs identified in comprehensive code review across 6 packages, prioritized P0-P3 to eliminate panics, resource leaks, and code quality issues.
> 
> **Deliverables**:
> - 20 bug fixes with corresponding tests
> - Race condition elimination (verified with `go test -race`)
> - Clean shutdown handling (no panics)
> - Dead code removal and code cleanup
> 
> **Estimated Effort**: Large (20 distinct issues across 6 packages)
> **Parallel Execution**: YES - 4 waves by priority
> **Critical Path**: P0-1 (shutdown) -> P0-2 (parser) -> P0-3 (watcher) -> P1 -> P2 -> P3

---

## Context

### Original Request
Comprehensive code review identified issues ranging from critical panics to minor code cleanup. Fix verified issues in priority order with proper testing.

### Interview Summary
**Key Discussions**:
- All issues categorized by severity (P0/P1/P2/P3)
- Tests exist and pass, but coverage gaps for edge cases
- TDD approach where applicable (not for main.go due to Bubble Tea)

**Research Findings**:
- Parser: Timestamp parsing assumes no "Z" suffix
- State: Unsafe type assertions
- Watcher: Double-close panics, file handle leaks
- Main: Shutdown race conditions, goroutine leaks
- UI: Unbounded scroll, panel height overflow on small terminals
- Session/Plan: Path resolution issues, error handling gaps, dead code

### Metis Review
**Identified Gaps** (addressed):
- Test coverage baseline unknown: Added coverage check to first task
- UI fixes need programmatic verification: Defined numeric invariants
- Fix ordering dependencies: Mapped in execution strategy
- P3 scope creep risk: Locked down with explicit boundaries per issue

### Momus Review (Issues Corrected)
**False Positives Removed**:
- ~~P1-7 Agent tree race~~: Verified already protected by mutex in `UpdateFromLogEntry()` (lines 107-145 under `s.mu.Lock()`)
- ~~P2-8 Key-value hyphen parsing~~: OpenCode uses camelCase keys (`providerID`), not hyphenated - not a real issue
- ~~P2-14 Goroutine counter bug~~: Code already correctly places `wg.Add(1)` AFTER `tail.TailFile()` succeeds (line 154)

**Testing Approach Updated**:
- P0-1/P1-4 (main.go): Use subprocess integration tests with built binary, not in-process unit tests (due to Bubble Tea + os.Exit)

---

## Work Objectives

### Core Objective
Eliminate all 20 verified bugs and code quality issues, with automated tests for each fix.

### Concrete Deliverables
- 3 P0 critical panic fixes (shutdown, parser, watcher)
- 3 P1 high-risk fixes (goroutine leak, file handle leak, scroll bounds)
- 4 P2 medium-risk fixes (type assertion, panel height, path resolution, error handling)
- 10 P3 low-risk fixes (dead code, cleanup, documentation)
- New tests for each fix

### Definition of Done
- [x] `go test -race ./...` passes with 0 race conditions
- [x] No panics on graceful shutdown (SIGTERM/SIGINT)
- [x] All 20 issues verified fixed with specific tests
- [x] No regressions in existing tests

### Must Have
- Failing test before fix where possible (proves bug exists)
- Passing test after fix (proves bug fixed)
- Race detector verification for concurrency fixes
- Atomic commits (one fix per commit)

### Must NOT Have (Guardrails)
- "While I'm here" adjacent improvements
- Function signature changes unless required for fix
- Code style refactoring in same commit as bug fix
- New features disguised as "improvements"
- Manual testing as acceptance criteria
- Bundled multi-fix commits
- Touching files not explicitly listed for each issue

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (go test)
- **User wants tests**: TDD where applicable
- **Framework**: Go standard testing + `-race` flag

### Main Package Testing (Special Case)

**Problem**: `cmd/ocwatch/main.go` uses Bubble Tea (`p.Run()`) and `os.Exit(0)`, making in-process unit tests unreliable.

**Solution**: Subprocess integration tests that:
1. Build the binary: `go build -o /tmp/ocwatch-test ./cmd/ocwatch`
2. Start process with timeout: `exec.CommandContext(ctx, "/tmp/ocwatch-test")`
3. Send SIGTERM and verify clean exit
4. Check exit code and stderr for panics

### TDD Workflow Per Issue (Non-Main Packages)

**Task Structure:**
1. **RED**: Write failing test first
   - Test file: `internal/[pkg]/[pkg]_test.go`
   - Test command: `go test -v -race ./internal/[pkg] -run TestBugXxx`
   - Expected: FAIL (test exists, fix doesn't)
2. **GREEN**: Implement minimum fix to pass
   - Command: `go test -v -race ./internal/[pkg] -run TestBugXxx`
   - Expected: PASS
3. **VERIFY**: Full suite still passes
   - Command: `go test -race ./...`
   - Expected: PASS (no regressions)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 - P0 Critical (Sequential - blocking issues):
├── Task 1: P0-1 Double-close panic (main.go)
├── Task 2: P0-2 Timestamp parsing (parser.go)
└── Task 3: P0-3 Watcher Stop() (watcher.go)

Wave 2 - P1 High (Can parallelize within wave):
├── Task 4: P1-1 Goroutine leak (main.go) [depends: Task 1]
├── Task 5: P1-2 File handle leak (watcher.go) [depends: Task 3]
└── Task 6: P1-3 Scroll bounds (ui.go) [independent]

Wave 3 - P2 Medium (Can parallelize):
├── Task 7: P2-1 Type assertion (state.go) [independent]
├── Task 8: P2-2 Panel height (ui.go) [depends: Task 6]
├── Task 9: P2-3 Boulder path (plan.go) [independent]
└── Task 10: P2-4 getStoragePath (session.go) [independent]

Wave 4 - P3 Low (Can parallelize):
├── Task 11: P3-1 Silent parse errors (watcher.go)
├── Task 12: P3-2 Unused Parser struct (parser.go)
├── Task 13: P3-3 Unused Plan struct (plan.go)
├── Task 14: P3-4 Unused boulder var (main.go)
├── Task 15: P3-5 Unused allSessions field (state.go)
├── Task 16: P3-6 Sidebar width const (ui.go)
├── Task 17: P3-7 Terminal size validation (ui.go)
├── Task 18: P3-8 Sidebar truncation (sidebar.go)
├── Task 19: P3-9 Session index clarity (ui.go)
└── Task 20: P3-10 ProjectWorktree docs (session.go)

Critical Path: Task 1 → Task 4 (main.go dependencies)
Parallel Speedup: ~60% faster with wave parallelization
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 4, 14 | 2, 3 |
| 2 | None | 12 | 1, 3 |
| 3 | None | 5, 11 | 1, 2 |
| 4 | 1 | None | 5, 6 |
| 5 | 3 | 11 | 4, 6 |
| 6 | None | 8, 16-19 | 4, 5 |
| 7-10 | Wave 2 | None | Each other |
| 11-20 | Wave 3 | None | Each other |

---

## TODOs

### Wave 1: P0 Critical Fixes

- [x] 1. P0-1: Fix double-close panic on shutdown ✅

  **What to do**:
  - Remove redundant `close(quitChan)` and `w.Stop()` on lines 99-100
  - Add `sync.Once` to ensure Stop() only executes once
  - Ensure graceful shutdown on both UI exit and signal

  **Must NOT do**:
  - Refactor shutdown architecture beyond fixing the panic
  - Add new shutdown features

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file, clear fix, < 20 lines changed
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4, Task 14
  - **Blocked By**: None

  **References**:
  - `cmd/ocwatch/main.go:72-100` - Shutdown logic with race condition
  - `cmd/ocwatch/main.go:86-91` - Signal handler calling w.Stop()
  - `cmd/ocwatch/main.go:99-100` - Redundant close after p.Run()
  - `internal/watcher/watcher.go:39-48` - Stop() implementation
  
  **Acceptance Criteria**:
  ```bash
  # Create subprocess integration test
  # 1. Build binary
  go build -o /tmp/ocwatch-test ./cmd/ocwatch
  
  # 2. Create test that starts process and sends SIGTERM twice
  go test -v ./cmd/ocwatch -run TestShutdownNoDoublePanic
  # Test spawns subprocess, sends SIGTERM, waits, verifies no panic in stderr
  # Expected: PASS (clean exit, no panic)
  
  # 3. Verify full suite
  go test -race ./...
  # Expected: PASS
  ```

  **Commit**: YES
  - Message: `fix(main): P0-1 prevent double-close panic on shutdown`
  - Files: `cmd/ocwatch/main.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 2. P0-2: Fix timestamp parsing bug ✅

  **What to do**:
  - Check if timestamp already ends with "Z" before appending
  - Handle both cases: with and without timezone suffix
  - Add test cases for both formats

  **Must NOT do**:
  - Rewrite entire parser
  - Add support for other timestamp formats

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single string/conditional fix, clear location
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 12
  - **Blocked By**: None

  **References**:
  - `internal/parser/parser.go:48-53` - Timestamp parsing with "Z" append
  - `internal/parser/parser_test.go:8-46` - Existing timestamp tests
  
  **Acceptance Criteria**:
  ```bash
  # RED: Test with "Z" suffix in timestamp
  go test -v ./internal/parser -run TestParseLine_TimestampWithZ
  # Input: "INFO 2026-01-31T10:05:40Z +1ms service=test"
  # Expected: FAIL (currently creates "2026-01-31T10:05:40ZZ")
  
  # GREEN: After fix
  go test -v ./internal/parser -run TestParseLine_TimestampWithZ
  # Expected: PASS, timestamp parsed correctly
  
  # Also test without Z to ensure no regression
  go test -v ./internal/parser -run TestParseLine
  # Expected: PASS
  ```

  **Commit**: YES
  - Message: `fix(parser): P0-2 handle timestamps with existing Z suffix`
  - Files: `internal/parser/parser.go`, `internal/parser/parser_test.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 3. P0-3: Fix watcher Stop() double-close ✅

  **What to do**:
  - Add `sync.Once` to Stop() to prevent double execution
  - Or add closed flag with mutex protection
  - Ensure tailer is set to nil after stopping

  **Must NOT do**:
  - Refactor entire watcher architecture
  - Change channel patterns

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Clear fix with sync primitive
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 5, Task 11
  - **Blocked By**: None

  **References**:
  - `internal/watcher/watcher.go:39-48` - Stop() with double-close risk
  - `internal/watcher/watcher_test.go:47-65` - Existing stop tests
  
  **Acceptance Criteria**:
  ```bash
  # RED: Test double Stop() call
  go test -v ./internal/watcher -run TestDoubleStopNoPanic
  # Create test that calls Stop() twice in succession
  # Expected: FAIL or PANIC before fix
  
  # GREEN: After fix
  go test -v ./internal/watcher -run TestDoubleStopNoPanic
  # Expected: PASS, no panic on second Stop()
  ```

  **Commit**: YES
  - Message: `fix(watcher): P0-3 prevent panic on double Stop() call`
  - Files: `internal/watcher/watcher.go`, `internal/watcher/watcher_test.go`
  - Pre-commit: `go test -race ./...`

---

### Wave 2: P1 High-Risk Fixes

- [x] 4. P1-1: Fix goroutine leak on UI exit ✅

  **What to do**:
  - Use context.Context for clean cancellation
  - Ensure processing goroutine exits when UI returns
  - Add WaitGroup to verify all goroutines complete
  - Extract shutdown coordination into testable helper function (minimal refactor allowed)

  **Must NOT do**:
  - Redesign entire main() architecture
  - Add new CLI features

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Concurrency fix requires careful context handling
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - `cmd/ocwatch/main.go:72-91` - Goroutine management
  - Standard Go context patterns for cancellation
  
  **Acceptance Criteria**:
  ```bash
  # Create subprocess test that verifies clean shutdown
  go test -v ./cmd/ocwatch -run TestNoGoroutineLeak
  # Test starts process, sends SIGTERM, waits for clean exit
  # Verify exit code 0 and no "goroutine leak" warnings
  # Expected: PASS
  
  # Alternative: extract shutdown logic to testable helper and unit test
  go test -v ./cmd/ocwatch -run TestShutdownHelper
  # Expected: PASS
  ```

  **Commit**: YES
  - Message: `fix(main): P1-1 prevent goroutine leak on UI exit`
  - Files: `cmd/ocwatch/main.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 5. P1-2: Fix watcher file handle leak ✅

  **What to do**:
  - Hold mutex across entire switchToFile() operation
  - Ensure oldTailer.Stop() completes before new tailer starts
  - Add proper cleanup on tail.TailFile() failure

  **Must NOT do**:
  - Rewrite file watching strategy
  - Add new file handling features

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Race condition fix requires mutex restructuring
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Task 11
  - **Blocked By**: Task 3

  **References**:
  - `internal/watcher/watcher.go:131-156` - switchToFile() race condition
  - `internal/watcher/watcher_test.go:122-162` - Rotation tests
  
  **Acceptance Criteria**:
  ```bash
  # RED: Test rapid file switching under race detector
  go test -v -race -count=50 ./internal/watcher -run TestRapidFileSwitch
  # Create test that rapidly creates new log files to trigger switching
  # Expected: FAIL (race detected) or file handle leak
  
  # GREEN: After fix
  go test -v -race -count=50 ./internal/watcher -run TestRapidFileSwitch
  # Expected: PASS, no race, no leaked handles
  ```

  **Commit**: YES
  - Message: `fix(watcher): P1-2 prevent file handle leak on rotation`
  - Files: `internal/watcher/watcher.go`, `internal/watcher/watcher_test.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 6. P1-3: Fix unbounded scroll offset ✅

  **What to do**:
  - Add upper bound check: `scroll <= max(0, len(entries) - viewportHeight)`
  - Ensure scroll stays within valid range on key press
  - Clamp scroll when content shrinks

  **Must NOT do**:
  - Add new scroll features (page up/down, etc.)
  - Change visual layout

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple bounds check addition
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 8, Task 16, Task 17, Task 18, Task 19
  - **Blocked By**: None

  **References**:
  - `internal/ui/ui.go:63-64` - Scroll handling without bounds
  - `internal/ui/panels.go:78-89` - Panel scroll rendering
  - `internal/ui/ui_test.go:40-54` - Existing scroll tests
  
  **Acceptance Criteria**:
  ```bash
  # RED: Test scroll beyond content
  go test -v ./internal/ui -run TestScrollBoundsEnforced
  # Create model with 10 entries, press down 100 times
  # Assert: scrollOffset after presses is clamped to valid range
  # Expected: FAIL (current code allows infinite scroll)
  
  # GREEN: After fix
  go test -v ./internal/ui -run TestScrollBoundsEnforced
  # Expected: PASS, scrollOffset <= maxValid
  ```

  **Commit**: YES
  - Message: `fix(ui): P1-3 enforce scroll offset bounds`
  - Files: `internal/ui/ui.go`, `internal/ui/ui_test.go`
  - Pre-commit: `go test -race ./...`

---

### Wave 3: P2 Medium-Risk Fixes

- [x] 7. P2-1: Fix unsafe type assertion ✅

  **What to do**:
  - Change `item.(*parser.LogEntry)` to safe assertion with ok check
  - Apply same fix in GetRecentToolCalls and GetFilteredToolCalls

  **Must NOT do**:
  - Change RingBuffer to be type-safe (would be larger refactor)
  - Add type safety project-wide

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple pattern replacement
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 15
  - **Blocked By**: None

  **References**:
  - `internal/state/state.go:167-179` - GetRecentLogs type assertion
  - `internal/state/state.go:182-194` - GetRecentToolCalls type assertion
  - `internal/state/state.go:270-287` - GetFilteredToolCalls type assertion
  
  **Acceptance Criteria**:
  ```bash
  # Verify no panic on type mismatch (defensive test)
  go test -v ./internal/state -run TestTypeAssertionSafe
  # Test shouldn't fail, but verifies code handles edge case
  # Expected: PASS, no panic on unexpected type
  ```

  **Commit**: YES
  - Message: `fix(state): P2-1 use safe type assertions`
  - Files: `internal/state/state.go`, `internal/state/state_test.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 8. P2-2: Fix panel height overflow ✅

  **What to do**:
  - Ensure sum of panel heights doesn't exceed available space
  - Adjust minimum panel height calculation
  - Handle edge case where terminal is too small

  **Must NOT do**:
  - Redesign panel layout system
  - Add responsive design features

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Math fix in height calculation
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:
  - `internal/ui/ui.go:149-152` - Panel height calculation
  
  **Acceptance Criteria**:
  ```bash
  # Test with very small terminal
  go test -v ./internal/ui -run TestPanelHeightSmallTerminal
  # Set height=15, verify sum of panel heights <= available height
  # Expected: PASS, no overflow
  ```

  **Commit**: YES
  - Message: `fix(ui): P2-2 prevent panel height overflow on small terminals`
  - Files: `internal/ui/ui.go`, `internal/ui/ui_test.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 9. P2-3: Fix boulder.json path resolution ✅

  **What to do**:
  - Resolve relative ActivePlan path relative to projectDir
  - Handle both absolute and relative paths correctly

  **Must NOT do**:
  - Change boulder.json schema
  - Add new plan features

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple filepath.Join fix
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 13
  - **Blocked By**: None

  **References**:
  - `internal/plan/plan.go:32-46` - ReadBoulder function
  - `internal/plan/plan_test.go:215-270` - Path resolution tests
  
  **Acceptance Criteria**:
  ```bash
  # Test relative path resolution from different cwd
  go test -v ./internal/plan -run TestBoulderRelativePathResolution
  # Create boulder with relative path, call ReadPlan from different directory
  # Expected: PASS, relative path resolved correctly against project dir
  ```

  **Commit**: YES
  - Message: `fix(plan): P2-3 resolve relative ActivePlan paths`
  - Files: `internal/plan/plan.go`, `internal/plan/plan_test.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 10. P2-4: Fix getStoragePath error handling ✅

  **What to do**:
  - Return proper fallback when UserHomeDir fails
  - Use os.TempDir() as fallback instead of empty path
  - Add warning log when using fallback

  **Must NOT do**:
  - Change session loading architecture
  - Add configuration for storage path

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple error handling fix
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 20
  - **Blocked By**: None

  **References**:
  - `internal/session/session.go:34-45` - getStoragePath with bug
  
  **Acceptance Criteria**:
  ```bash
  # Verify returns valid path even when UserHomeDir would fail
  go test -v ./internal/session -run TestGetStoragePathFallback
  # Mock or simulate UserHomeDir failure
  # Expected: PASS, returns valid path (not "/.local/share")
  ```

  **Commit**: YES
  - Message: `fix(session): P2-4 handle UserHomeDir error properly`
  - Files: `internal/session/session.go`, `internal/session/session_test.go`
  - Pre-commit: `go test -race ./...`

---

### Wave 4: P3 Low-Risk Fixes

- [x] 11. P3-1: Add logging for parse errors ✅

  **What to do**:
  - Add optional logger to Watcher struct
  - Log parse failures at debug level with line content
  - Keep default behavior (no logging) if logger not set

  **Must NOT do**:
  - Add complex logging framework
  - Make logging mandatory

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:
  - `internal/watcher/watcher.go:174-177` - Silent error handling
  
  **Acceptance Criteria**:
  ```bash
  go test -v ./internal/watcher -run TestParseErrorsLogged
  # Expected: PASS, log output contains error message for malformed lines
  ```

  **Commit**: YES
  - Message: `fix(watcher): P3-1 log parse errors for debugging`
  - Files: `internal/watcher/watcher.go`, `internal/watcher/watcher_test.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 12. P3-2: Remove unused Parser struct ✅

  **What to do**:
  - Use `lsp_find_references` to verify no usage
  - Delete Parser struct and NewParser() function

  **Must NOT do**:
  - Refactor surrounding code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `internal/parser/parser.go:22-28` - Unused struct
  
  **Acceptance Criteria**:
  ```bash
  # Verify no references exist, then delete
  go test -race ./...
  # Expected: PASS, builds without unused struct
  ```

  **Commit**: YES
  - Message: `refactor(parser): P3-2 remove unused Parser struct`
  - Files: `internal/parser/parser.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 13. P3-3: Remove unused Plan struct ✅

  **What to do**:
  - Use `lsp_find_references` to verify no usage
  - Delete Plan struct and NewPlan() function

  **Must NOT do**:
  - Refactor surrounding code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 9

  **References**:
  - `internal/plan/plan.go:25-30` - Unused struct
  
  **Acceptance Criteria**:
  ```bash
  go test -race ./...
  # Expected: PASS
  ```

  **Commit**: YES
  - Message: `refactor(plan): P3-3 remove unused Plan struct`
  - Files: `internal/plan/plan.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 14. P3-4: Remove unused boulder variable ✅

  **What to do**:
  - Remove the unused boulder loading block (lines 56-61)

  **Must NOT do**:
  - Add new boulder features

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - `cmd/ocwatch/main.go:56-61` - Unused boulder loading
  
  **Acceptance Criteria**:
  ```bash
  go build ./cmd/ocwatch && go test -race ./...
  # Expected: PASS, no unused variable warning
  ```

  **Commit**: YES
  - Message: `refactor(main): P3-4 remove unused boulder loading`
  - Files: `cmd/ocwatch/main.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 15. P3-5: Remove unused allSessions field ✅

  **What to do**:
  - Use `lsp_find_references` to verify field not read
  - Remove field from State struct
  - Remove SetAllSessions method

  **Must NOT do**:
  - Major refactoring of state

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 7

  **References**:
  - `internal/state/state.go:84` - allSessions field
  - `internal/state/state.go:229-234` - SetAllSessions method
  
  **Acceptance Criteria**:
  ```bash
  # Verify references show field is set but never read
  go test -race ./...
  # Expected: PASS
  ```

  **Commit**: YES
  - Message: `refactor(state): P3-5 remove unused allSessions field`
  - Files: `internal/state/state.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 16. P3-6: Consolidate sidebar width constant ✅

  **What to do**:
  - Keep constant in one place only (ui.go)
  - Remove duplicate from sidebar.go
  - Reference the single constant from sidebar.go

  **Must NOT do**:
  - Change sidebar width value
  - Refactor layout system

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:
  - `internal/ui/ui.go:109` - const sidebarWidth = 28
  - `internal/ui/sidebar.go:13` - const sidebarWidth = 28 (duplicate)
  
  **Acceptance Criteria**:
  ```bash
  # Verify only one definition exists after change
  go test -race ./...
  # Expected: PASS
  ```

  **Commit**: YES
  - Message: `refactor(ui): P3-6 consolidate sidebar width constant`
  - Files: `internal/ui/ui.go`, `internal/ui/sidebar.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 17. P3-7: Add terminal size validation ✅

  **What to do**:
  - Check both width AND height in View()
  - Show meaningful message if terminal too small (< 80x24)

  **Must NOT do**:
  - Add responsive design
  - Change minimum size requirements

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:
  - `internal/ui/ui.go:104-106` - Only checks width currently
  - AGENTS.md - Documents 80x24 minimum
  
  **Acceptance Criteria**:
  ```bash
  go test -v ./internal/ui -run TestSmallTerminalMessage
  # Set width=60, height=20
  # Expected: PASS, shows "Terminal too small" message
  ```

  **Commit**: YES
  - Message: `fix(ui): P3-7 validate minimum terminal size`
  - Files: `internal/ui/ui.go`, `internal/ui/ui_test.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 18. P3-8: Fix sidebar truncation off-by-one ✅

  **What to do**:
  - Truncate to 22 chars + ellipsis = 23, leaving room in 24-char field
  - Ensure ellipsis is visible

  **Must NOT do**:
  - Change sidebar layout
  - Add new truncation features

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:
  - `internal/ui/sidebar.go:31-44` - Truncation logic
  
  **Acceptance Criteria**:
  ```bash
  go test -v ./internal/ui -run TestSidebarTruncationEllipsisVisible
  # Create session with 30-char name
  # Verify ellipsis appears and is visible
  # Expected: PASS
  ```

  **Commit**: YES
  - Message: `fix(ui): P3-8 correct sidebar truncation to show ellipsis`
  - Files: `internal/ui/sidebar.go`, `internal/ui/sidebar_test.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 19. P3-9: Clarify session selection indexing ✅

  **What to do**:
  - Add comments explaining 1-indexed UI vs 0-indexed array
  - Document the pattern clearly for future maintainers

  **Must NOT do**:
  - Change user-facing key bindings
  - Break existing functionality

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 6

  **References**:
  - `internal/ui/ui.go:71-76` - Session selection logic
  - `internal/ui/ui_test.go:96-137` - Selection tests
  
  **Acceptance Criteria**:
  ```bash
  # Existing tests still pass
  go test -v ./internal/ui -run TestKeyHandler
  # Expected: PASS, documentation added but behavior unchanged
  ```

  **Commit**: YES
  - Message: `docs(ui): P3-9 clarify session index documentation`
  - Files: `internal/ui/ui.go`
  - Pre-commit: `go test -race ./...`

---

- [x] 20. P3-10: Document ProjectWorktree population ✅

  **What to do**:
  - Add comment to Session struct explaining ProjectWorktree is only populated via ListAllSessions
  - Or populate in GetSessionWithPath by looking up project (if needed)

  **Must NOT do**:
  - Change session data structure
  - Add new session features

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: None
  - **Blocked By**: Task 10

  **References**:
  - `internal/session/session.go:11-20` - Session struct
  - `internal/session/project.go:91-93` - Where ProjectWorktree is set
  
  **Acceptance Criteria**:
  ```bash
  # Documentation added, existing tests pass
  go test -race ./...
  # Expected: PASS
  ```

  **Commit**: YES
  - Message: `docs(session): P3-10 document ProjectWorktree population`
  - Files: `internal/session/session.go`
  - Pre-commit: `go test -race ./...`

---

## Commit Strategy

| Wave | After Task | Message Pattern | Verification |
|------|------------|-----------------|--------------|
| 1 | 1 | `fix(main): P0-1 ...` | `go test -race ./...` |
| 1 | 2 | `fix(parser): P0-2 ...` | `go test -race ./...` |
| 1 | 3 | `fix(watcher): P0-3 ...` | `go test -race ./...` |
| 2 | 4-6 | `fix(pkg): P1-N ...` | `go test -race ./...` |
| 3 | 7-10 | `fix(pkg): P2-N ...` | `go test -race ./...` |
| 4 | 11-20 | `fix/refactor/docs(pkg): P3-N ...` | `go test -race ./...` |

---

## Success Criteria

### Verification Commands
```bash
# Full test suite with race detection
go test -race ./...
# Expected: PASS, 0 races

# Build verification
go build ./cmd/ocwatch
# Expected: SUCCESS, no warnings

# Subprocess shutdown test
./ocwatch &
PID=$!
sleep 1
kill -TERM $PID
wait $PID
echo "Exit code: $?"
# Expected: Exit code: 0, no panic output
```

### Final Checklist
- [x] All 20 issues have passing tests
- [x] `go test -race ./...` shows 0 races
- [x] No panics on shutdown (tested with SIGTERM)
- [x] All dead code removed (verified with lsp_find_references)
- [x] UI works correctly on 80x24 terminal minimum
