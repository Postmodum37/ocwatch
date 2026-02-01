# Filter Root Sessions in Sidebar

## TL;DR

> **Quick Summary**: Fix the session parser to read `parentID` from JSON files, then filter API endpoints to return only root sessions (sessions without `parentID`). This will show actual OpenCode sessions in the sidebar instead of mixing in spawned sub-sessions.
> 
> **Deliverables**:
> - Fixed `SessionJSON` interface with `parentID` field
> - Fixed `parseSession()` to read `parentID` from JSON
> - Filtered `/api/sessions` endpoint (root sessions only)
> - Filtered `/api/poll` endpoint (root sessions only)
> - Unit test for `parentID` parsing
> 
> **Estimated Effort**: Quick (~30 minutes)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

---

## Context

### Original Request
"I want sidebar to actually show sessions as separate OpenCode sessions. Now it shows something more like tasks."

The problem: Spawned sub-sessions (explore, oracle, delegate_task agents) appear as separate sidebar entries instead of being filtered out. Only ROOT sessions (sessions without `parentID`) should appear in the sidebar.

### Interview Summary
**Key Findings**:
- Session JSON files DO contain `parentID` for sub-sessions (verified in actual storage)
- Root sessions have NO `parentID` field; sub-sessions have `parentID` pointing to parent
- Bug location: `sessionParser.ts` has `SessionJSON` interface missing `parentID` field
- Bug location: `parseSession()` hardcodes `parentID: undefined` instead of reading from JSON

**Research Findings**:
- `SessionMetadata` type already has `parentID?: string` (shared/types/index.ts:14)
- `buildSessionTree()` already uses `session.parentID` correctly (index.ts:94,102)
- API response already includes `parentID` field in serialization (index.ts:174)
- Existing test expects `parentID` undefined for root sessions (parsers.test.ts:65)

### Data Structure Verification

**Root session** (no parentID field):
```json
{
  "id": "ses_3e5f0fb49ffeau5JF6uGYfyPMx",
  "slug": "clever-rocket",
  "projectID": "386043c27ba886538edc95090a732275ede2d4db",
  "directory": "/Users/tomas/Workspace/ocwatch",
  "title": "Sidebar session display fix",
  "time": { "created": 1769963717814, "updated": 1769963731553 }
}
```

**Sub-session** (HAS parentID field):
```json
{
  "id": "ses_3e5f0c5feffeOibVDaGPMieOOf",
  "parentID": "ses_3e5f0fb49ffeau5JF6uGYfyPMx",
  "title": "Explore session storage parsing (@explore subagent)",
  "permission": [...],
  ...
}
```

---

## Work Objectives

### Core Objective
Filter sidebar to show only root sessions by fixing the parser to read `parentID` and filtering API responses.

### Concrete Deliverables
- `src/server/storage/sessionParser.ts` - Fixed interface and parser
- `src/server/index.ts` - Filtered `/api/sessions` and `/api/poll` endpoints
- `src/server/storage/__tests__/parsers.test.ts` - Test for parentID parsing

### Definition of Done
- [x] `bun run tsc -b` passes with no errors
- [x] `bun test` passes with all tests green
- [x] API `/api/sessions` returns only sessions where `parentID` is undefined
- [x] API `/api/poll` returns only root sessions in `sessions` array

### Must Have
- Parser reads `parentID` from JSON (not hardcoded undefined)
- Both list endpoints filter out sub-sessions
- Test coverage for parentID parsing

### Must NOT Have (Guardrails)
- NO changes to frontend code (not needed - will auto-work)
- NO changes to `/api/sessions/:id` endpoint (single session fetch should still work)
- NO changes to `/api/sessions/:id/tree` endpoint (tree visualization needs all sessions)
- NO changes to `buildSessionTree()` function (already works correctly)
- NO filtering of `activeSession` in poll response (keep as-is for now)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test)
- **User wants tests**: YES (add test for parentID parsing)
- **Framework**: bun:test
- **QA approach**: TDD-lite (add test, then implementation)

### Automated Verification

**For Backend Changes** (using Bash):
```bash
# Type checking
bun run tsc -b
# Expected: Exit code 0, no errors

# Run all tests
bun test
# Expected: All tests pass

# Verify API filtering (manual curl check)
curl -s http://localhost:50234/api/sessions | jq '.[].parentID'
# Expected: All values should be null (no sub-sessions returned)
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Fix SessionJSON interface + parseSession()
└── Task 3: Add unit test for parentID parsing (can write test structure)

Wave 2 (After Wave 1):
├── Task 2: Filter /api/sessions endpoint
└── Task 4: Filter /api/poll endpoint

Wave 3 (After Wave 2):
└── Task 5: Run verification and commit

Critical Path: Task 1 → Task 2 → Task 5
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3, 4 | 3 (test structure) |
| 2 | 1 | 5 | 4 |
| 3 | 1 | 5 | 2, 4 |
| 4 | 1 | 5 | 2, 3 |
| 5 | 2, 3, 4 | None | None (final) |

---

## TODOs

- [x] 1. Fix SessionJSON interface and parseSession function

  **What to do**:
  - Add `parentID?: string` to `SessionJSON` interface (after line 20)
  - Change line 65 from `parentID: undefined` to `parentID: json.parentID`

  **Must NOT do**:
  - Do not change any other fields in the interface
  - Do not add validation for parentID (optional field is fine)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, targeted edit to two lines in one file
  - **Skills**: None needed
    - This is a simple TypeScript edit, no special skills required

  **Parallelization**:
  - **Can Run In Parallel**: NO (foundational change)
  - **Parallel Group**: Wave 1 (alone for safety)
  - **Blocks**: Tasks 2, 3, 4
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/server/storage/sessionParser.ts:14-25` - SessionJSON interface (add field here)
  - `src/server/storage/sessionParser.ts:60-68` - parseSession return statement (fix line 65)

  **Type References**:
  - `src/shared/types/index.ts:9-19` - SessionMetadata interface (already has `parentID?: string`)

  **Documentation References**:
  - Actual session JSON structure verified in Context section above

  **Acceptance Criteria**:

  ```bash
  # Type check passes
  bun run tsc -b
  # Expected: Exit code 0

  # Verify parseSession now reads parentID from JSON (test will confirm)
  ```

  **Commit**: NO (group with task 2)

---

- [x] 2. Filter /api/sessions endpoint to return only root sessions

  **What to do**:
  - After line 157 (`const limitedSessions = sortedSessions.slice(0, 20);`), add filter:
    ```typescript
    const rootSessions = limitedSessions.filter(s => !s.parentID);
    ```
  - Update line 159 to use `rootSessions` instead of `limitedSessions` in the map

  **Must NOT do**:
  - Do not change the 24-hour filter logic
  - Do not change the sorting logic
  - Do not change the max 20 limit (apply filter AFTER limit for consistency)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small change, add one filter line and update one reference
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/server/index.ts:149-157` - Current filtering/sorting logic (add after this)
  - `src/server/index.ts:159-180` - Session enrichment loop (change reference here)

  **Acceptance Criteria**:

  ```bash
  # After server restart, verify filtering
  curl -s http://localhost:50234/api/sessions | jq 'map(select(.parentID != null)) | length'
  # Expected: 0 (no sessions with parentID returned)
  ```

  **Commit**: NO (group with tasks 1, 3, 4)

---

- [x] 3. Add unit test for parentID parsing

  **What to do**:
  - In `src/server/storage/__tests__/parsers.test.ts`, add new test case after line 66:
    ```typescript
    test("parseSession - reads parentID from JSON", async () => {
      const sessionPath = join(
        STORAGE_DIR,
        "session",
        PROJECT_ID,
        "ses_child.json"
      );
      const sessionData = {
        id: "ses_child",
        slug: "child-session",
        projectID: PROJECT_ID,
        directory: "/test/dir",
        title: "Child Session",
        parentID: "ses_parent123",
        time: {
          created: 1700000000000,
          updated: 1700000001000,
        },
      };

      await writeFile(sessionPath, JSON.stringify(sessionData));

      const result = await parseSession(sessionPath);

      expect(result).not.toBeNull();
      expect(result?.parentID).toBe("ses_parent123");
    });
    ```

  **Must NOT do**:
  - Do not modify existing tests
  - Do not remove the existing test that expects undefined parentID (it tests root sessions)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Add one test case following existing patterns
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/server/storage/__tests__/parsers.test.ts:33-66` - Existing parseSession tests (follow this pattern)

  **Test References**:
  - `src/server/storage/__tests__/parsers.test.ts:21-27` - Test setup (uses same constants)

  **Acceptance Criteria**:

  ```bash
  # Run parser tests
  bun test src/server/storage/__tests__/parsers.test.ts
  # Expected: All tests pass including new parentID test
  ```

  **Commit**: NO (group with tasks 1, 2, 4)

---

- [x] 4. Filter /api/poll endpoint to return only root sessions

  **What to do**:
  - After line 321 (`const limitedSessions = sortedSessions.slice(0, 20);`), add filter:
    ```typescript
    const rootSessions = limitedSessions.filter(s => !s.parentID);
    ```
  - Update line 324-333 to use `rootSessions` instead of `limitedSessions`
  - Update line 337 to use `rootSessions` instead of `limitedSessions` for activeSession search

  **Must NOT do**:
  - Do not filter the `activeSession` result itself (if a sub-session is active, that's fine)
  - Do not change the ETag generation logic
  - Do not change plan progress logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small change, same pattern as Task 2
  - **Skills**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/server/index.ts:313-321` - Current filtering/sorting in poll (add after this)
  - `src/server/index.ts:324-347` - Session enrichment and activeSession logic (update references)

  **Acceptance Criteria**:

  ```bash
  # After server restart, verify poll filtering
  curl -s http://localhost:50234/api/poll | jq '.sessions | map(select(.parentID != null)) | length'
  # Expected: 0 (no sessions with parentID in poll response)
  ```

  **Commit**: NO (group with tasks 1, 2, 3)

---

- [x] 5. Run verification and create commit

  **What to do**:
  - Run `bun run tsc -b` to verify type checking
  - Run `bun test` to verify all tests pass
  - Create commit with all changes

  **Must NOT do**:
  - Do not commit if tests fail
  - Do not commit if type checking fails

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and git operations only
  - **Skills**: `['git-master']`
    - `git-master`: For proper commit message formatting

  **Parallelization**:
  - **Can Run In Parallel**: NO (final verification)
  - **Parallel Group**: Wave 3 (alone)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 2, 3, 4

  **References**:

  **Documentation References**:
  - `AGENTS.md:COMMANDS` - Verification commands to run

  **Acceptance Criteria**:

  ```bash
  # Type checking
  bun run tsc -b
  # Expected: Exit code 0

  # All tests pass
  bun test
  # Expected: All tests pass

  # Git status shows expected changes
  git status --short
  # Expected: M src/server/storage/sessionParser.ts
  #           M src/server/index.ts
  #           M src/server/storage/__tests__/parsers.test.ts
  ```

  **Commit**: YES
  - Message: `fix(api): filter sidebar to show only root sessions`
  - Files: `src/server/storage/sessionParser.ts`, `src/server/index.ts`, `src/server/storage/__tests__/parsers.test.ts`
  - Pre-commit: `bun test && bun run tsc -b`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 5 | `fix(api): filter sidebar to show only root sessions` | sessionParser.ts, index.ts, parsers.test.ts | `bun test && bun run tsc -b` |

---

## Success Criteria

### Verification Commands
```bash
# Type checking
bun run tsc -b
# Expected: Exit code 0

# All tests pass
bun test
# Expected: All tests pass

# API returns only root sessions
curl -s http://localhost:50234/api/sessions | jq 'map(select(.parentID != null)) | length'
# Expected: 0

curl -s http://localhost:50234/api/poll | jq '.sessions | map(select(.parentID != null)) | length'
# Expected: 0
```

### Final Checklist
- [x] SessionJSON interface includes `parentID?: string`
- [x] parseSession() reads `json.parentID` instead of hardcoded undefined
- [x] /api/sessions returns only sessions where parentID is undefined
- [x] /api/poll sessions array contains only root sessions
- [x] New test verifies parentID is read from JSON
- [x] All existing tests still pass
- [x] Type checking passes
