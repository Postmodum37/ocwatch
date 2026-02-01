# OCWatch TypeScript Migration

## TL;DR

> **Quick Summary**: Migrate OCWatch from Go/Bubble Tea TUI to TypeScript/Bun web dashboard for monitoring OpenCode CLI agent activity. Complete technology rewrite with modern web stack.
> 
> **Deliverables**:
> - Bun + Hono backend server reading OpenCode storage
> - React + Vite + Tailwind frontend dashboard
> - Session list, agent tree (React Flow), tool calls, plan progress
> - HTTP polling (2s) with dirty-flag caching
> - Auto-open browser on launch
> - Delete old Go code
> 
> **Estimated Effort**: Large (XL)
> **Parallel Execution**: YES - 6 waves
> **Critical Path**: Task 1 → Task 3 → Task 6 → Task 15 → Task 17

---

## Context

### Original Request
Migrate OCWatch from Go + Bubble Tea TUI to TypeScript + Bun web dashboard. The TUI doesn't work well. Reference: oh-my-opencode-dashboard. Target: OpenCode CLI (NOT Claude Code).

### Interview Summary
**Key Discussions**:
- **Tech stack**: Bun + Hono backend, React + Vite + Tailwind frontend
- **Data source**: OpenCode storage files (not log tailing)
- **Updates**: HTTP polling every 2 seconds (simpler than WebSocket)
- **Agent tree**: Visual node graph using React Flow with session.parentID hierarchy
- **Active session**: Last message < 5 minutes ago
- **Part files**: Lazy load on demand only (25k+ files, cannot bulk read)
- **Project scope**: User-switchable dropdown, default to current directory
- **Design**: Dark mode, minimal (GitHub/Linear style)
- **Testing**: TDD approach

**Research Findings**:
- OpenCode storage: `~/.local/share/opencode/storage/{session,message,part}/`
- Session has parentID field for hierarchy
- Message has agent/mode/modelID fields
- Reference repo uses 2.2s polling with dirty-flag caching
- 25,748+ part files - must lazy-load

### Metis Review
**Identified Gaps** (addressed):
- Agent tree data source → Using session.parentID
- Polling vs WebSocket → Polling (simpler, sufficient)
- Active session definition → Last message < 5 minutes
- Part files handling → Lazy load on demand
- Project scope → User-switchable dropdown

---

## Work Objectives

### Core Objective
Replace Go TUI with TypeScript web dashboard for real-time OpenCode agent monitoring.

### Concrete Deliverables
- `src/server/` - Bun + Hono API server
- `src/client/` - React + Vite SPA
- `http://localhost:50234` - Dashboard accessible locally
- Session list with active/idle status
- Agent hierarchy tree visualization
- Tool calls collapsible panel
- Plan progress from boulder.json
- Project switcher dropdown

### Definition of Done
- [x] `bun run dev` starts server and opens browser
- [x] Dashboard shows sessions from OpenCode storage
- [x] Agent tree displays session.parentID hierarchy
- [x] Tool calls show from lazy-loaded part files
- [x] Plan progress reads `.sisyphus/boulder.json`
- [x] All tests pass: `bun test`
- [x] Go code removed from repository

### Must Have
- Real-time updates via 2-second polling
- Session list with timestamps and status
- Agent tree using React Flow
- Dark mode UI
- Localhost-only access
- Auto-open browser on launch

### Must NOT Have (Guardrails)
- ❌ Token/cost estimation
- ❌ Complex search/filter UI
- ❌ Data export (CSV/JSON)
- ❌ Notifications/alerts
- ❌ Remote access (localhost only)
- ❌ Historical analytics/charts
- ❌ WebSocket (use polling)
- ❌ SSR (SPA only)
- ❌ Mobile responsive (desktop 1280x720 min)
- ❌ Database/persistence (read-only from fs)
- ❌ User preferences storage (stateless)
- ❌ Bulk-read part/ files at startup (25k+ files)
- ❌ React Flow node editing/rearrangement (display only)
- ❌ Bi-directional WebSocket commands
- ❌ Session archival/all-time history
- ❌ Custom icons (use Lucide React only)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (new project)
- **User wants tests**: TDD
- **Framework**: bun test (built-in)

### TDD Workflow
Each TODO follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

### Test Setup Task
Task 1 includes test infrastructure setup with initial passing test.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Project setup (Bun + TypeScript)
└── Task 2: Frontend setup (Vite + React)

Wave 2 (After Wave 1):
├── Task 3: Core TypeScript types
├── Task 4: Storage parsers
└── Task 5: Ring buffer implementation

Wave 3 (After Wave 2):
├── Task 6: Hono server + routes
├── Task 7: Session API endpoints
├── Task 8: File watcher + dirty-flag cache
└── Task 9: Polling mechanism

Wave 4 (After Wave 2, parallel with Wave 3):
├── Task 10: Tailwind + dark theme
├── Task 11: Session list sidebar
├── Task 12: Agent tree (React Flow)
├── Task 13: Tool calls panel
└── Task 14: Plan progress display

Wave 5 (After Wave 3 & 4):
├── Task 15: Connect frontend to API
├── Task 16: Project switcher dropdown
└── Task 17: Auto-browser open + CLI flags

Wave 6 (After Wave 5):
├── Task 18: Error handling + graceful degradation
├── Task 19: Remove Go code
└── Task 20: Final integration tests
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3,4,5,6,7,8,9 | 2 |
| 2 | None | 10,11,12,13,14 | 1 |
| 3 | 1 | 4,5,6,7 | None |
| 4 | 3 | 7,8,15 | 5 |
| 5 | 3 | 7,15 | 4 |
| 6 | 3 | 7,8,9,15 | 10,11,12,13,14 |
| 7 | 4,5,6 | 15,16 | 8,9 |
| 8 | 4,6 | 9,15 | 7 |
| 9 | 8 | 15 | None |
| 10 | 2 | 11,12,13,14 | 6,7,8,9 |
| 11 | 10 | 15 | 12,13,14 |
| 12 | 10 | 15 | 11,13,14 |
| 13 | 10 | 15 | 11,12,14 |
| 14 | 10 | 15 | 11,12,13 |
| 15 | 7,9,11,12,13,14 | 16,17 | None |
| 16 | 15 | 17 | None |
| 17 | 15 | 18 | 16 |
| 18 | 17 | 19 | None |
| 19 | 18 | 20 | None |
| 20 | 19 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Dispatch |
|------|-------|---------------------|
| 1 | 1, 2 | Parallel: category="quick" for each |
| 2 | 3, 4, 5 | Sequential 3 first, then parallel 4,5 |
| 3 | 6, 7, 8, 9 | Sequential: 6 → parallel(7,8) → 9 |
| 4 | 10, 11, 12, 13, 14 | Sequential 10 first, then parallel rest |
| 5 | 15, 16, 17 | Sequential: 15 → parallel(16,17) |
| 6 | 18, 19, 20 | Sequential |

---

## TODOs

### Wave 1: Project Foundation

- [x] 1. Initialize Bun + TypeScript Project

  **What to do**:
  - Create new Bun project with TypeScript config
  - Setup project structure: `src/server/`, `src/client/`, `src/shared/`
  - Configure path aliases (`@server/`, `@client/`, `@shared/`)
  - Setup bun test configuration
  - Create initial passing test to verify setup
  - Add .gitignore for node_modules, dist, .env

  **Must NOT do**:
  - Don't install unnecessary dependencies
  - Don't add complex build configurations
  - Don't setup CI/CD

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard project scaffolding, well-defined steps
  - **Skills**: [`git-master`]
    - `git-master`: Will need to handle git operations when setting up

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 4, 5, 6, 7, 8, 9
  - **Blocked By**: None

  **References**:
  - **Pattern References**: None (new project)
  - **External References**:
    - Bun docs: https://bun.sh/docs/typescript - TypeScript configuration
    - Bun test: https://bun.sh/docs/cli/test - Test runner setup

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file created: `src/shared/__tests__/setup.test.ts`
  - [x] Test covers: Basic assertion to verify test runner works
  - [x] `bun test` → PASS (1 test, 0 failures)

  **Automated Verification:**
  ```bash
  # Verify project structure exists
  ls -la src/server src/client src/shared
  # Assert: All three directories exist
  
  # Verify TypeScript compiles
  bun build ./src/shared/index.ts --outdir ./dist --target bun
  # Assert: Exit code 0
  
  # Verify tests run
  bun test
  # Assert: Exit code 0, output contains "1 pass"
  ```

  **Evidence to Capture:**
  - [x] Output of `bun test` showing passing test
  - [x] Output of `ls -la src/` showing structure

  **Commit**: YES
  - Message: `feat(setup): initialize bun + typescript project structure`
  - Files: `package.json`, `tsconfig.json`, `src/**`, `.gitignore`
  - Pre-commit: `bun test`

---

- [x] 2. Setup Vite + React Frontend

  **What to do**:
  - Initialize Vite with React + TypeScript template in `src/client/`
  - Configure Vite to work within Bun project
  - Setup development proxy to backend (port 50234)
  - Add React 18, React DOM
  - Verify hot reload works

  **Must NOT do**:
  - Don't add UI components yet
  - Don't add state management yet
  - Don't add routing (SPA with single page)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard Vite scaffolding
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 10, 11, 12, 13, 14
  - **Blocked By**: None

  **References**:
  - **External References**:
    - Vite docs: https://vitejs.dev/guide/ - Setup guide
    - Vite + React: https://vitejs.dev/guide/#scaffolding-your-first-vite-project

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Verify Vite dev server starts
  cd src/client && timeout 10 bun run dev &
  sleep 5
  curl -s http://localhost:5173 | grep -q "<!DOCTYPE html>"
  # Assert: HTML returned (exit code 0)
  
  # Kill dev server
  pkill -f "vite"
  
  # Verify build works
  cd src/client && bun run build
  # Assert: dist/ directory created
  ls src/client/dist/index.html
  # Assert: File exists
  ```

  **Evidence to Capture:**
  - [x] Output of `curl http://localhost:5173` returning HTML
  - [x] Output of `ls src/client/dist/` showing built files

  **Commit**: YES
  - Message: `feat(client): setup vite + react frontend scaffold`
  - Files: `src/client/**`
  - Pre-commit: `cd src/client && bun run build`

---

### Wave 2: Core Types & Parsing

- [x] 3. Define Core TypeScript Types

  **What to do**:
  - Create types in `src/shared/types/`:
    - `SessionMetadata`: id, projectID, directory, title, parentID, createdAt, updatedAt
    - `MessageMeta`: id, sessionID, role, agent, mode, modelID, providerID, parentID, tokens, createdAt
    - `PartMeta`: id, sessionID, messageID, type, callID, tool, state
    - `AgentInfo`: name, mode, modelID, active, sessionID
    - `ToolCall`: id, name, state, timestamp, sessionID, messageID
    - `PlanProgress`: completed, total, progress, tasks
    - `Boulder`: activePlan, sessionIDs, status, startedAt, planName
  - Create RingBuffer<T> generic class (max 1000)
  - Add type exports from index.ts

  **Must NOT do**:
  - Don't add API types yet (Task 7)
  - Don't add validation (just types)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Type definitions are straightforward
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (must complete before 4,5)
  - **Blocks**: Tasks 4, 5, 6, 7
  - **Blocked By**: Task 1

  **References**:
  - **Pattern References**:
    - `internal/state/state.go:15-45` - Original Go types to port
    - `internal/parser/parser.go:8-20` - LogEntry structure
    - `internal/plan/plan.go:10-25` - Boulder and PlanProgress
  - **API/Type References**:
    - oh-my-opencode-dashboard types (from research): SessionMetadata, StoredMessageMeta, StoredToolPart

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `src/shared/__tests__/types.test.ts`
  - [x] Test covers: Type instantiation, RingBuffer add/get operations
  - [x] `bun test src/shared/__tests__/types.test.ts` → PASS

  **Automated Verification:**
  ```bash
  # Verify types compile
  bun build ./src/shared/types/index.ts --outdir ./dist --target bun
  # Assert: Exit code 0
  
  # Verify types are exported
  bun -e "import { SessionMetadata, RingBuffer } from './src/shared/types'; console.log('types OK')"
  # Assert: Output is "types OK"
  ```

  **Commit**: YES
  - Message: `feat(types): define core typescript types and ring buffer`
  - Files: `src/shared/types/**`
  - Pre-commit: `bun test`

---

- [x] 4. Implement Storage Parsers

  **What to do**:
  - Create `src/server/storage/`:
    - `sessionParser.ts`: Read session JSON files from `~/.local/share/opencode/storage/session/`
    - `messageParser.ts`: Read message JSON files from `storage/message/`
    - `partParser.ts`: Read single part file on demand (lazy loading)
    - `boulderParser.ts`: Read `.sisyphus/boulder.json` for plan progress
  - Handle XDG_DATA_HOME override
  - Add file-not-found graceful handling
  - Parse parentID for session hierarchy

  **Must NOT do**:
  - Don't read all part files (lazy load only)
  - Don't cache in this task (Task 8 handles caching)
  - Don't add watch functionality yet

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: File parsing with error handling, moderate complexity
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Tasks 7, 8, 15
  - **Blocked By**: Task 3

  **References**:
  - **Pattern References**:
    - `internal/session/session.go:20-60` - Go session loading logic
    - `internal/plan/plan.go:30-80` - Boulder JSON parsing
  - **Documentation References**:
    - OpenCode storage structure (from Metis research):
      ```
      ~/.local/share/opencode/storage/
      ├── session/   # Session JSON files (by project hash)
      ├── message/   # Message JSON files (by session ID)
      └── part/      # Part JSON files (tool calls)
      ```

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `src/server/storage/__tests__/parsers.test.ts`
  - [x] Test covers: Parse valid session JSON, handle missing files gracefully, parse parentID
  - [x] `bun test src/server/storage/__tests__/` → PASS

  **Automated Verification:**
  ```bash
  # Create mock storage and test parsing
  mkdir -p /tmp/ocwatch-test/storage/session
  echo '{"id":"ses_test","title":"Test","parentID":"ses_parent"}' > /tmp/ocwatch-test/storage/session/test.json
  
  bun -e "
    import { parseSession } from './src/server/storage/sessionParser';
    const s = await parseSession('/tmp/ocwatch-test/storage/session/test.json');
    console.log(s.id === 'ses_test' && s.parentID === 'ses_parent' ? 'OK' : 'FAIL');
  "
  # Assert: Output is "OK"
  
  rm -rf /tmp/ocwatch-test
  ```

  **Commit**: YES
  - Message: `feat(storage): implement opencode storage parsers`
  - Files: `src/server/storage/**`
  - Pre-commit: `bun test`

---

- [x] 5. Implement Ring Buffer

  **What to do**:
  - Create `src/shared/utils/RingBuffer.ts`
  - Generic RingBuffer<T> class with:
    - Constructor(capacity: number) - default 1000
    - push(item: T): void - add item, drop oldest if full
    - getAll(): T[] - return all items in order
    - getLatest(n: number): T[] - return last n items
    - clear(): void
    - size: number (getter)
  - Add unit tests for all operations

  **Must NOT do**:
  - Don't add persistence
  - Don't add thread-safety (JS is single-threaded)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple data structure implementation
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Tasks 7, 15
  - **Blocked By**: Task 3

  **References**:
  - **Pattern References**:
    - `internal/state/state.go:50-90` - Go RingBuffer implementation

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `src/shared/utils/__tests__/RingBuffer.test.ts`
  - [x] Test covers: push, getAll, getLatest, capacity overflow, clear
  - [x] `bun test src/shared/utils/__tests__/` → PASS (5+ tests)

  **Automated Verification:**
  ```bash
  bun -e "
    import { RingBuffer } from './src/shared/utils/RingBuffer';
    const rb = new RingBuffer<number>(3);
    rb.push(1); rb.push(2); rb.push(3); rb.push(4);
    const all = rb.getAll();
    console.log(all.length === 3 && all[0] === 2 && all[2] === 4 ? 'OK' : 'FAIL');
  "
  # Assert: Output is "OK"
  ```

  **Commit**: YES (groups with Task 3)
  - Message: `feat(utils): implement ring buffer data structure`
  - Files: `src/shared/utils/**`
  - Pre-commit: `bun test`

---

### Wave 3: Backend API

- [x] 6. Setup Hono Server + Routes

  **What to do**:
  - Create `src/server/index.ts` with Hono app
  - Configure port 50234
  - Add routes:
    - `GET /api/health` - Health check
    - `GET /api/sessions` - List sessions
    - `GET /api/sessions/:id` - Session details
    - `GET /api/sessions/:id/messages` - Session messages
    - `GET /api/sessions/:id/tree` - Agent hierarchy tree
    - `GET /api/parts/:id` - Single part file (lazy load)
    - `GET /api/plan` - Plan progress from boulder.json
    - `GET /api/projects` - List available projects
  - Add CORS for localhost only
  - Add static file serving for client build

  **Must NOT do**:
  - Don't implement route handlers yet (stubs only)
  - Don't add authentication
  - Don't add WebSocket

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Standard Hono setup with route stubs
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 3 start)
  - **Blocks**: Tasks 7, 8, 9, 15
  - **Blocked By**: Task 3

  **References**:
  - **External References**:
    - Hono docs: https://hono.dev/docs/getting-started/bun - Bun setup
    - Hono routing: https://hono.dev/docs/api/routing - Route definition

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `src/server/__tests__/routes.test.ts`
  - [x] Test covers: Health endpoint returns 200, routes are defined
  - [x] `bun test src/server/__tests__/routes.test.ts` → PASS

  **Automated Verification:**
  ```bash
  # Start server in background
  bun run src/server/index.ts &
  SERVER_PID=$!
  sleep 2
  
  # Test health endpoint
  curl -s http://localhost:50234/api/health | jq -r '.status'
  # Assert: Output is "ok"
  
  # Test sessions endpoint exists (may return empty)
  curl -s -o /dev/null -w "%{http_code}" http://localhost:50234/api/sessions
  # Assert: 200
  
  kill $SERVER_PID
  ```

  **Commit**: YES
  - Message: `feat(server): setup hono server with api route stubs`
  - Files: `src/server/**`
  - Pre-commit: `bun test`

---

- [x] 7. Implement Session API Endpoints

  **What to do**:
  - Implement `GET /api/sessions`:
    - Return sessions from last 24h OR last 20 (whichever fewer)
    - Include: id, title, projectID, parentID, createdAt, isActive (last msg < 5 min)
    - Sort by updatedAt descending
  - Implement `GET /api/sessions/:id`:
    - Full session details
    - Include agent hierarchy built from session.parentID
  - Implement `GET /api/sessions/:id/messages`:
    - Return messages for session
    - Include: agent, mode, modelID, createdAt
    - Limit to last 100 messages
  - Implement `GET /api/sessions/:id/tree`:
    - Build tree from session.parentID relationships
    - Return nodes/edges format for React Flow
  - Implement `GET /api/projects`:
    - List unique projectIDs from sessions
    - Include project directory paths

  **Must NOT do**:
  - Don't load part files here (separate endpoint)
  - Don't add pagination (ring buffer handles limits)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: API implementation with data transformation
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: Tasks 15, 16
  - **Blocked By**: Tasks 4, 5, 6

  **References**:
  - **Pattern References**:
    - `internal/session/session.go:FilterSessionsByToday` - Filtering logic
    - `internal/session/session.go:FilterActiveSessions` - Active session definition
  - **API/Type References**:
    - Types from Task 3: SessionMetadata, MessageMeta, AgentInfo

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `src/server/__tests__/sessions.test.ts`
  - [x] Test covers: List sessions, filter by time, build tree, handle empty state
  - [x] `bun test src/server/__tests__/sessions.test.ts` → PASS

  **Automated Verification:**
  ```bash
  # Requires OpenCode to have some sessions
  bun run src/server/index.ts &
  SERVER_PID=$!
  sleep 2
  
  # Test sessions list
  curl -s http://localhost:50234/api/sessions | jq 'type == "array"'
  # Assert: true
  
  # Test projects list
  curl -s http://localhost:50234/api/projects | jq 'type == "array"'
  # Assert: true
  
  kill $SERVER_PID
  ```

  **Commit**: YES
  - Message: `feat(api): implement session and project endpoints`
  - Files: `src/server/routes/**`, `src/server/services/**`
  - Pre-commit: `bun test`

---

- [x] 8. Implement File Watcher + Dirty-Flag Cache

  **What to do**:
  - Create `src/server/watcher/`:
    - Use `fs.watch()` on OpenCode storage directories
    - Implement dirty-flag pattern: mark data stale on file change
    - Debounce rapid changes (100ms)
  - Create `src/server/cache/`:
    - In-memory cache for parsed sessions/messages
    - Invalidate on dirty flag
    - Recompute on next request if stale
    - Cache TTL: 2 seconds max

  **Must NOT do**:
  - Don't watch part/ directory (too many files)
  - Don't add persistence
  - Don't poll (use fs.watch events)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: File system watching with caching logic
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Tasks 9, 15
  - **Blocked By**: Tasks 4, 6

  **References**:
  - **Pattern References**:
    - `internal/watcher/watcher.go` - Go file watching implementation
  - **External References**:
    - Bun fs.watch: https://bun.sh/docs/api/fs#watching-files
    - oh-my-opencode-dashboard caching pattern (from research): dirty-flag with 2s timeout

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `src/server/watcher/__tests__/watcher.test.ts`
  - [x] Test covers: File change triggers dirty flag, cache invalidation
  - [x] `bun test src/server/watcher/__tests__/` → PASS

  **Automated Verification:**
  ```bash
  # Test watcher responds to file changes
  mkdir -p /tmp/ocwatch-watcher-test
  bun -e "
    import { createWatcher } from './src/server/watcher';
    const w = createWatcher('/tmp/ocwatch-watcher-test');
    let changed = false;
    w.on('change', () => { changed = true; });
    await Bun.write('/tmp/ocwatch-watcher-test/test.json', '{}');
    await new Promise(r => setTimeout(r, 200));
    console.log(changed ? 'OK' : 'FAIL');
    w.close();
  "
  # Assert: Output is "OK"
  rm -rf /tmp/ocwatch-watcher-test
  ```

  **Commit**: YES
  - Message: `feat(watcher): implement file watcher with dirty-flag cache`
  - Files: `src/server/watcher/**`, `src/server/cache/**`
  - Pre-commit: `bun test`

---

- [x] 9. Implement Polling Mechanism

  **What to do**:
  - Create `GET /api/poll` endpoint:
    - Return: { sessions, activeSession, planProgress, lastUpdate }
    - Uses cache from Task 8
    - Include ETag header for client-side change detection
  - Client polls this every 2 seconds
  - Return 304 Not Modified if nothing changed

  **Must NOT do**:
  - Don't add WebSocket
  - Don't add long-polling
  - Don't poll faster than 2 seconds

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple endpoint wrapping cache
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 8)
  - **Blocks**: Task 15
  - **Blocked By**: Task 8

  **References**:
  - **Pattern References**:
    - oh-my-opencode-dashboard (from research): 2.2s polling interval
  - **API/Type References**:
    - Cache from Task 8

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `src/server/__tests__/poll.test.ts`
  - [x] Test covers: Returns data, ETag header present, 304 on no change
  - [x] `bun test src/server/__tests__/poll.test.ts` → PASS

  **Automated Verification:**
  ```bash
  bun run src/server/index.ts &
  SERVER_PID=$!
  sleep 2
  
  # First request
  ETAG=$(curl -s -D - http://localhost:50234/api/poll | grep -i etag | cut -d' ' -f2)
  
  # Second request with ETag should return 304
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "If-None-Match: $ETAG" http://localhost:50234/api/poll)
  echo $STATUS
  # Assert: 304
  
  kill $SERVER_PID
  ```

  **Commit**: YES
  - Message: `feat(api): implement polling endpoint with etag caching`
  - Files: `src/server/routes/poll.ts`
  - Pre-commit: `bun test`

---

### Wave 4: Frontend UI Components

- [x] 10. Setup Tailwind + Dark Theme

  **What to do**:
  - Install Tailwind CSS for Vite
  - Configure dark mode as default (class-based)
  - Create color palette (GitHub/Linear inspired):
    - Background: `#0d1117`
    - Surface: `#161b22`
    - Border: `#30363d`
    - Text primary: `#c9d1d9`
    - Text secondary: `#8b949e`
    - Accent: `#58a6ff`
    - Success: `#238636`
    - Warning: `#d29922`
    - Error: `#f85149`
  - Create base layout component with dark background
  - Install Lucide React for icons

  **Must NOT do**:
  - Don't add light mode toggle
  - Don't add custom fonts (use system fonts)
  - Don't add animations beyond 150ms transitions

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI/styling setup
  - **Skills**: [`frontend-ui-ux`, `design-principles`]
    - `frontend-ui-ux`: Tailwind configuration expertise
    - `design-principles`: Minimal dark mode design

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 start
  - **Blocks**: Tasks 11, 12, 13, 14
  - **Blocked By**: Task 2

  **References**:
  - **External References**:
    - Tailwind + Vite: https://tailwindcss.com/docs/guides/vite
    - Lucide React: https://lucide.dev/guide/packages/lucide-react

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Verify Tailwind config exists
  cat src/client/tailwind.config.js | grep -q "darkMode"
  # Assert: Exit code 0
  
  # Verify dark mode class in HTML
  cat src/client/index.html | grep -q 'class="dark"'
  # Assert: Exit code 0
  
  # Verify build works with Tailwind
  cd src/client && bun run build
  # Assert: Exit code 0
  
  # Verify CSS contains dark colors
  grep -q "0d1117" src/client/dist/assets/*.css
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `feat(ui): setup tailwind with dark theme`
  - Files: `src/client/tailwind.config.js`, `src/client/src/styles/**`, `src/client/index.html`
  - Pre-commit: `cd src/client && bun run build`

---

- [x] 11. Build Session List Sidebar

  **What to do**:
  - Create `src/client/src/components/SessionList.tsx`:
    - Fixed left sidebar (280px width)
    - List sessions with: title (truncated), timestamp, status indicator
    - Active sessions: green dot
    - Idle sessions: gray dot
    - Selected session: highlighted background
    - Click to select session
  - Show project name at top of sidebar
  - Add project dropdown (for Task 16)

  **Must NOT do**:
  - Don't add search/filter
  - Don't add sorting options
  - Don't add session actions (delete, rename)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with styling
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React component patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 12, 13, 14)
  - **Blocks**: Task 15
  - **Blocked By**: Task 10

  **References**:
  - **Pattern References**:
    - `internal/ui/panels.go:renderSessionsPanel` - Go session list rendering
  - **External References**:
    - oh-my-opencode-dashboard UI (from research): Session list pattern

  **Acceptance Criteria**:

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173
  2. Wait for: selector "[data-testid='session-list']" to be visible
  3. Assert: Sidebar element exists with width ~280px
  4. Assert: At least one session item visible OR empty state message
  5. Screenshot: .sisyphus/evidence/task-11-session-list.png
  ```

  **Commit**: YES
  - Message: `feat(ui): build session list sidebar component`
  - Files: `src/client/src/components/SessionList.tsx`
  - Pre-commit: `cd src/client && bun run build`

---

- [x] 12. Build Agent Tree View (React Flow)

  **What to do**:
  - Install React Flow: `bun add reactflow`
  - Create `src/client/src/components/AgentTree.tsx`:
    - Display session hierarchy from session.parentID
    - Node content: session title + agent type + model
    - Auto-layout using dagre
    - Zoom/pan enabled (built-in)
    - Click node to select session
    - Status colors: active=green, idle=gray

  **Must NOT do**:
  - Don't allow node editing or rearrangement
  - Don't add minimap
  - Don't add custom node shapes
  - Don't show message-level hierarchy (too granular)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex UI component with graph library
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React Flow integration

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 11, 13, 14)
  - **Blocks**: Task 15
  - **Blocked By**: Task 10

  **References**:
  - **External References**:
    - React Flow: https://reactflow.dev/docs/quickstart/
    - React Flow + Dagre: https://reactflow.dev/docs/examples/layout/dagre/
  - **Documentation References**:
    - Session parentID structure (from Metis research):
      ```json
      {"id":"ses_child", "parentID":"ses_parent"}
      ```

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `src/client/src/components/__tests__/AgentTree.test.tsx`
  - [x] Test covers: Renders without crashing, handles empty data, builds nodes from sessions
  - [x] `cd src/client && bun test` → PASS

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173
  2. Click: first session in list
  3. Wait for: selector ".react-flow" to be visible
  4. Assert: React Flow container rendered
  5. Assert: At least one node visible OR empty state
  6. Screenshot: .sisyphus/evidence/task-12-agent-tree.png
  ```

  **Commit**: YES
  - Message: `feat(ui): build agent tree visualization with react flow`
  - Files: `src/client/src/components/AgentTree.tsx`
  - Pre-commit: `cd src/client && bun run build`

---

- [x] 13. Build Tool Calls Panel

  **What to do**:
  - Create `src/client/src/components/ToolCalls.tsx`:
    - Collapsible panel at bottom of main view
    - List recent tool calls for selected session
    - Show: tool name, state (pending/complete/error), timestamp
    - Lazy load part file details on expand
    - Ring buffer display (max 1000)
  - Color coding: pending=yellow, complete=green, error=red

  **Must NOT do**:
  - Don't load all part files upfront
  - Don't show tool input/output (privacy)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with lazy loading
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 11, 12, 14)
  - **Blocks**: Task 15
  - **Blocked By**: Task 10

  **References**:
  - **Pattern References**:
    - `internal/ui/panels.go:renderToolsPanel` - Go tool calls rendering
  - **API/Type References**:
    - ToolCall type from Task 3
    - `GET /api/parts/:id` endpoint from Task 6

  **Acceptance Criteria**:

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173
  2. Click: first session with tool calls
  3. Wait for: selector "[data-testid='tool-calls-panel']"
  4. Click: panel header to expand
  5. Assert: Tool call list visible
  6. Screenshot: .sisyphus/evidence/task-13-tool-calls.png
  ```

  **Commit**: YES
  - Message: `feat(ui): build tool calls collapsible panel`
  - Files: `src/client/src/components/ToolCalls.tsx`
  - Pre-commit: `cd src/client && bun run build`

---

- [x] 14. Build Plan Progress Display

  **What to do**:
  - Create `src/client/src/components/PlanProgress.tsx`:
    - Read from boulder.json via API
    - Show: plan name, progress bar, completed/total
    - List tasks with checkbox status
    - Update on poll refresh
  - Place in header or sidebar top

  **Must NOT do**:
  - Don't show full markdown content
  - Don't allow task editing
  - Don't show plans from other projects

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 11, 12, 13)
  - **Blocks**: Task 15
  - **Blocked By**: Task 10

  **References**:
  - **Pattern References**:
    - `internal/plan/plan.go:CalculateProgress` - Progress calculation
  - **API/Type References**:
    - PlanProgress type from Task 3
    - `GET /api/plan` endpoint from Task 6

  **Acceptance Criteria**:

  **TDD:**
  - [x] Test file: `src/client/src/components/__tests__/PlanProgress.test.tsx`
  - [x] Test covers: Renders progress bar, handles no plan state
  - [x] `cd src/client && bun test` → PASS

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173
  2. Wait for: selector "[data-testid='plan-progress']" OR empty state
  3. If progress exists: Assert progress bar percentage matches completed/total
  4. Screenshot: .sisyphus/evidence/task-14-plan-progress.png
  ```

  **Commit**: YES
  - Message: `feat(ui): build plan progress display component`
  - Files: `src/client/src/components/PlanProgress.tsx`
  - Pre-commit: `cd src/client && bun run build`

---

### Wave 5: Integration

- [x] 15. Connect Frontend to API

  **What to do**:
  - Create `src/client/src/hooks/`:
    - `usePolling.ts`: Poll `/api/poll` every 2 seconds
    - `useSessions.ts`: Fetch and cache session list
    - `useSessionTree.ts`: Fetch agent tree for selected session
  - Create `src/client/src/store/`:
    - Simple React Context for app state
    - Selected session ID
    - Current project filter
  - Wire up all components to API data
  - Handle loading/error states

  **Must NOT do**:
  - Don't add Redux or Zustand (Context is sufficient)
  - Don't add optimistic updates

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Integration work connecting existing pieces
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React hooks and context

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 5 start)
  - **Blocks**: Tasks 16, 17
  - **Blocked By**: Tasks 7, 9, 11, 12, 13, 14

  **References**:
  - **Pattern References**:
    - All UI components from Tasks 11-14
    - All API endpoints from Tasks 7, 9
  - **External References**:
    - React Query (optional): https://tanstack.com/query/latest

  **Acceptance Criteria**:

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Start backend: bun run src/server/index.ts
  2. Start frontend: cd src/client && bun run dev
  3. Navigate to: http://localhost:5173
  4. Wait for: Network request to /api/poll completes
  5. Assert: Session list populated from API (not mock data)
  6. Click: first session
  7. Assert: Agent tree updates with session data
  8. Wait 3 seconds
  9. Assert: Another /api/poll request made (polling works)
  10. Screenshot: .sisyphus/evidence/task-15-integration.png
  ```

  **Commit**: YES
  - Message: `feat(integration): connect frontend to backend api`
  - Files: `src/client/src/hooks/**`, `src/client/src/store/**`, `src/client/src/App.tsx`
  - Pre-commit: `cd src/client && bun run build`

---

- [x] 16. Implement Project Switcher Dropdown

  **What to do**:
  - Add dropdown to sidebar header
  - List projects from `GET /api/projects`
  - Default to project matching current working directory
  - Filter sessions by selected project
  - Persist selection in URL query param (not localStorage)

  **Must NOT do**:
  - Don't add project creation/deletion
  - Don't persist to localStorage (stateless)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple dropdown component
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UI component

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 17)
  - **Blocks**: Task 17
  - **Blocked By**: Task 15

  **References**:
  - **API/Type References**:
    - `GET /api/projects` endpoint from Task 7

  **Acceptance Criteria**:

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173
  2. Click: project dropdown selector
  3. Assert: Dropdown menu opens with project list
  4. Click: different project option
  5. Assert: Session list updates to show filtered sessions
  6. Assert: URL contains project query param
  7. Screenshot: .sisyphus/evidence/task-16-project-switcher.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add project switcher dropdown`
  - Files: `src/client/src/components/ProjectSwitcher.tsx`
  - Pre-commit: `cd src/client && bun run build`

---

- [x] 17. Add Auto-Browser Open + CLI Flags

  **What to do**:
  - Update server startup to open browser automatically
  - Add CLI flags:
    - `--port <number>` - Override port (default 50234)
    - `--no-browser` - Skip auto-open browser
    - `--project <path>` - Set default project filter
  - Add package.json scripts:
    - `bun run start` - Production server
    - `bun run dev` - Development with hot reload
  - Print startup message with URL

  **Must NOT do**:
  - Don't add config file support
  - Don't add environment variable config

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: CLI argument parsing
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 16)
  - **Blocks**: Task 18
  - **Blocked By**: Task 15

  **References**:
  - **Pattern References**:
    - `cmd/ocwatch/main.go` - Go CLI flag handling
  - **External References**:
    - Bun open: `Bun.spawn(["open", url])`

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Test --help shows flags
  bun run src/server/index.ts --help 2>&1 | grep -q "no-browser"
  # Assert: Exit code 0
  
  # Test --no-browser doesn't open browser
  timeout 5 bun run src/server/index.ts --no-browser &
  sleep 2
  curl -s http://localhost:50234/api/health | jq -r '.status'
  # Assert: "ok"
  pkill -f "src/server/index.ts"
  
  # Test custom port
  timeout 5 bun run src/server/index.ts --port 50999 --no-browser &
  sleep 2
  curl -s http://localhost:50999/api/health | jq -r '.status'
  # Assert: "ok"
  pkill -f "src/server/index.ts"
  ```

  **Commit**: YES
  - Message: `feat(cli): add auto-browser open and cli flags`
  - Files: `src/server/cli.ts`, `package.json`
  - Pre-commit: `bun test`

---

### Wave 6: Polish & Cleanup

- [x] 18. Error Handling + Graceful Degradation

  **What to do**:
  - Add error boundary to React app
  - Handle missing OpenCode storage:
    - Show "OpenCode not found" message
    - Provide instructions to install OpenCode
  - Handle corrupted JSON files: skip and log
  - Handle empty states: "No active sessions" message
  - Handle server disconnect: show status indicator, auto-retry
  - Add loading skeletons during data fetch

  **Must NOT do**:
  - Don't crash on errors
  - Don't show raw error messages to user

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Error handling across app
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UI error states

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 19
  - **Blocked By**: Task 17

  **References**:
  - **Pattern References**:
    - Error handling patterns from Tasks 4, 6, 7
  - **External References**:
    - React Error Boundary: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Test missing storage directory
  mv ~/.local/share/opencode ~/.local/share/opencode.bak 2>/dev/null || true
  bun run src/server/index.ts --no-browser &
  SERVER_PID=$!
  sleep 2
  
  curl -s http://localhost:50234/api/sessions | jq -r '.error // "no error"'
  # Assert: Contains "not found" or empty array (no crash)
  
  kill $SERVER_PID
  mv ~/.local/share/opencode.bak ~/.local/share/opencode 2>/dev/null || true
  ```

  **Automated Verification (Playwright):**
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173
  2. Simulate: Server disconnect (stop backend)
  3. Wait 5 seconds
  4. Assert: Disconnect indicator visible
  5. Restart backend
  6. Wait 10 seconds
  7. Assert: Reconnected, data displayed
  8. Screenshot: .sisyphus/evidence/task-18-error-handling.png
  ```

  **Commit**: YES
  - Message: `feat(error): add error handling and graceful degradation`
  - Files: `src/client/src/components/ErrorBoundary.tsx`, `src/server/middleware/error.ts`
  - Pre-commit: `bun test`

---

- [x] 19. Remove Go Code

  **What to do**:
  - Delete all Go files and directories:
    - `cmd/ocwatch/`
    - `internal/`
    - `go.mod`
    - `go.sum`
    - `ocwatch` (binary)
  - Update README.md:
    - Remove Go installation instructions
    - Add Bun installation instructions
    - Update usage section
    - Update keybindings section (remove TUI-specific)
  - Update .gitignore for new stack

  **Must NOT do**:
  - Don't delete docs or config files
  - Don't delete .sisyphus directory
  - Don't delete AGENTS.md (needs update in Task 20)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File deletion and doc update
  - **Skills**: [`git-master`]
    - `git-master`: Clean commit history

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 20
  - **Blocked By**: Task 18

  **References**:
  - **Documentation References**:
    - Current README.md
    - AGENTS.md (needs update reference)

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Verify Go code removed
  ls cmd/ocwatch 2>&1 | grep -q "No such file"
  # Assert: Exit code 0 (directory doesn't exist)
  
  ls internal 2>&1 | grep -q "No such file"
  # Assert: Exit code 0
  
  ls go.mod 2>&1 | grep -q "No such file"
  # Assert: Exit code 0
  
  # Verify README updated
  grep -q "bun" README.md
  # Assert: Exit code 0
  
  grep -q "go install" README.md
  # Assert: Exit code 1 (should NOT be present)
  ```

  **Commit**: YES
  - Message: `chore(cleanup): remove go code, update readme for typescript`
  - Files: `cmd/`, `internal/`, `go.mod`, `go.sum`, `ocwatch`, `README.md`, `.gitignore`
  - Pre-commit: None (Go code gone)

---

- [x] 20. Final Integration Tests + AGENTS.md Update

  **What to do**:
  - Create integration test suite:
    - Full startup test (server + client)
    - API endpoint tests with real storage
    - UI component render tests
  - Update AGENTS.md:
    - New project structure
    - New code map (TypeScript symbols)
    - New commands section
    - Remove Go-specific notes
  - Run full test suite
  - Verify all acceptance criteria met

  **Must NOT do**:
  - Don't require CI/CD setup
  - Don't add performance benchmarks

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Integration testing and documentation
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final (must be last)
  - **Blocks**: None
  - **Blocked By**: Task 19

  **References**:
  - **Documentation References**:
    - AGENTS.md - needs full rewrite for new stack
  - **Pattern References**:
    - All completed tasks

  **Acceptance Criteria**:

  **Automated Verification:**
  ```bash
  # Run full test suite
  bun test
  # Assert: All tests pass
  
  # Verify AGENTS.md updated
  grep -q "TypeScript" AGENTS.md
  # Assert: Exit code 0
  
  grep -q "Go" AGENTS.md
  # Assert: Exit code 1 (should NOT mention Go as primary)
  
  # Full startup test
  bun run start --no-browser &
  SERVER_PID=$!
  sleep 3
  
  # Verify all endpoints
  curl -s http://localhost:50234/api/health | jq -r '.status'
  # Assert: "ok"
  
  curl -s http://localhost:50234/api/sessions | jq 'type'
  # Assert: "array"
  
  curl -s http://localhost:50234/api/projects | jq 'type'
  # Assert: "array"
  
  curl -s http://localhost:50234/api/plan | jq 'type'
  # Assert: "object" or "null"
  
  kill $SERVER_PID
  ```

  **Commit**: YES
  - Message: `feat(complete): add integration tests, update agents.md`
  - Files: `src/**/__tests__/**`, `AGENTS.md`
  - Pre-commit: `bun test`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(setup): initialize bun + typescript project structure` | package.json, tsconfig.json, src/** | `bun test` |
| 2 | `feat(client): setup vite + react frontend scaffold` | src/client/** | `cd src/client && bun run build` |
| 3 | `feat(types): define core typescript types and ring buffer` | src/shared/types/** | `bun test` |
| 4 | `feat(storage): implement opencode storage parsers` | src/server/storage/** | `bun test` |
| 5 | `feat(utils): implement ring buffer data structure` | src/shared/utils/** | `bun test` |
| 6 | `feat(server): setup hono server with api route stubs` | src/server/** | `bun test` |
| 7 | `feat(api): implement session and project endpoints` | src/server/routes/**, src/server/services/** | `bun test` |
| 8 | `feat(watcher): implement file watcher with dirty-flag cache` | src/server/watcher/**, src/server/cache/** | `bun test` |
| 9 | `feat(api): implement polling endpoint with etag caching` | src/server/routes/poll.ts | `bun test` |
| 10 | `feat(ui): setup tailwind with dark theme` | src/client/tailwind.config.js, src/client/src/styles/** | `cd src/client && bun run build` |
| 11 | `feat(ui): build session list sidebar component` | src/client/src/components/SessionList.tsx | `cd src/client && bun run build` |
| 12 | `feat(ui): build agent tree visualization with react flow` | src/client/src/components/AgentTree.tsx | `cd src/client && bun run build` |
| 13 | `feat(ui): build tool calls collapsible panel` | src/client/src/components/ToolCalls.tsx | `cd src/client && bun run build` |
| 14 | `feat(ui): build plan progress display component` | src/client/src/components/PlanProgress.tsx | `cd src/client && bun run build` |
| 15 | `feat(integration): connect frontend to backend api` | src/client/src/hooks/**, src/client/src/store/** | `cd src/client && bun run build` |
| 16 | `feat(ui): add project switcher dropdown` | src/client/src/components/ProjectSwitcher.tsx | `cd src/client && bun run build` |
| 17 | `feat(cli): add auto-browser open and cli flags` | src/server/cli.ts, package.json | `bun test` |
| 18 | `feat(error): add error handling and graceful degradation` | src/client/src/components/ErrorBoundary.tsx, src/server/middleware/error.ts | `bun test` |
| 19 | `chore(cleanup): remove go code, update readme for typescript` | cmd/, internal/, go.mod, README.md | None |
| 20 | `feat(complete): add integration tests, update agents.md` | src/**/__tests__/**, AGENTS.md | `bun test` |

---

## Success Criteria

### Verification Commands
```bash
# Start application
bun run dev
# Expected: Server starts, browser opens to http://localhost:50234

# Run all tests
bun test
# Expected: All tests pass

# Verify no Go code
ls cmd internal go.mod 2>&1
# Expected: All "No such file or directory"

# API health check
curl http://localhost:50234/api/health
# Expected: {"status":"ok"}
```

### Final Checklist
- [x] All "Must Have" present (sessions, tree, tools, plan, dark mode)
- [x] All "Must NOT Have" absent (no WebSocket, no token estimation, no analytics)
- [x] All tests pass (`bun test` exits 0)
- [x] Go code completely removed
- [x] README reflects new TypeScript stack
- [x] AGENTS.md reflects new code structure
- [x] Dashboard loads in browser
- [x] Polling updates every ~2 seconds
- [x] Agent tree displays session hierarchy
- [x] Tool calls lazy-load on demand
- [x] Plan progress shows from boulder.json
- [x] Project switcher works
