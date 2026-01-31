# OCWatch TypeScript Migration - Learnings

## Task 3: Core TypeScript Types

### Completed
- ✅ Created `src/shared/types/index.ts` with all 8 type definitions
- ✅ Implemented RingBuffer<T> generic class with full API
- ✅ Created comprehensive test suite (28 tests, all passing)
- ✅ Verified types compile and exports work
- ✅ Committed with message: `feat(types): define core typescript types and ring buffer`

### Type Definitions Implemented
1. **SessionMetadata** - OpenCode session with parentID for hierarchy
2. **MessageMeta** - Message with agent/mode/modelID fields
3. **PartMeta** - Tool call part file metadata
4. **AgentInfo** - Active agent information
5. **ToolCall** - Tool invocation with state (pending/complete/error)
6. **PlanProgress** - Plan progress tracking (completed/total/progress/tasks)
7. **Boulder** - Current plan state from boulder.json
8. **RingBuffer<T>** - Generic circular buffer (capacity 1000 default)

### RingBuffer Implementation Details
- **Capacity**: Default 1000, enforces minimum of 1
- **Methods**:
  - `push(item: T)` - Add item, drop oldest if full
  - `getAll(): T[]` - Return all items in order (oldest→newest)
  - `getLatest(n: number): T[]` - Return last n items (newest first)
  - `clear()` - Clear all items
  - `size` getter - Current item count
- **Circular Buffer Logic**: Uses head pointer to track oldest item position
- **Order Preservation**: Reconstructs correct order when buffer is full

### Test Coverage
- Type instantiation for all 8 types
- RingBuffer operations: push, overflow, getAll, getLatest, clear, size
- Generic type support (number, string, objects)
- Edge cases: empty buffer, capacity overflow, multiple cycles

### Key Patterns
- Optional fields use `?:` syntax (parentID, agent, mode, etc.)
- Union types for ToolCall state: `"pending" | "complete" | "error"`
- Generic class syntax: `class RingBuffer<T>`
- Circular buffer with head pointer for efficient overflow

### Next Steps (Task 4)
- Storage parsers will use these types to parse OpenCode JSON files
- SessionMetadata.parentID will be used to build agent hierarchy tree
- ToolCall type will be populated from part files
- RingBuffer will store log entries and tool calls in memory

### Notes
- All tests pass: `bun test` → 31 pass (28 new + 3 existing)
- Build verification: `bun build ./src/shared/types/index.ts` → 0.82 KB
- Export verification: Types import correctly in other modules

## Task 4: Storage Parsers

### Completed
- ✅ Created `src/server/storage/sessionParser.ts` - Parse session JSON files
- ✅ Created `src/server/storage/messageParser.ts` - Parse message JSON files
- ✅ Created `src/server/storage/partParser.ts` - Lazy-load part files
- ✅ Created `src/server/storage/boulderParser.ts` - Parse boulder.json and plan progress
- ✅ Created comprehensive test suite with 19 tests (all passing)
- ✅ Verified XDG_DATA_HOME support
- ✅ Committed with message: `feat(storage): implement opencode storage parsers`

### Parser Implementations

#### sessionParser.ts
- **getStoragePath()**: Respects XDG_DATA_HOME, defaults to ~/.local/share
- **parseSession()**: Parse single session JSON, returns null on error
- **getSession()**: Get session by projectID + sessionID
- **listSessions()**: List all sessions for a project
- **Key insight**: OpenCode sessions don't have parentID in storage (unlike messages)

#### messageParser.ts
- **parseMessage()**: Parse message JSON with tokens calculation
- **getMessage()**: Get message by messageID
- **listMessages()**: Filter messages by sessionID
- **Token handling**: Sum input + output tokens from JSON structure

#### partParser.ts
- **parsePart()**: Lazy-load single part file
- **getPart()**: Get part by partID
- **CRITICAL**: No listParts() function - 25,748+ files require lazy loading only
- **Design decision**: Only load parts on demand, never enumerate all

#### boulderParser.ts
- **parseBoulder()**: Parse .sisyphus/boulder.json
- **calculatePlanProgress()**: Count markdown checkboxes
- **parseCheckboxes()**: Regex pattern `/-\s+\[([ xX])\]\s*(.+)/g`
- **Progress calculation**: (completed / total) * 100
- **Path handling**: Convert relative activePlan to absolute path

### OpenCode Storage Structure
```
~/.local/share/opencode/storage/
├── session/{projectID}/{sessionID}.json
├── message/{messageID}.json
└── part/{partID}.json
```

### JSON Format Insights

**Session JSON:**
```json
{
  "id": "ses_xxx",
  "slug": "session-slug",
  "version": "1.1.39",
  "projectID": "hash",
  "directory": "/path",
  "title": "Session title",
  "time": {
    "created": 1769628160279,  // Unix ms
    "updated": 1769628160330
  }
}
```

**Message JSON:**
```json
{
  "id": "msg_xxx",
  "sessionID": "ses_xxx",
  "role": "assistant",
  "time": { "created": 1769858876673, "completed": 1769858881590 },
  "parentID": "msg_parent",
  "modelID": "claude-haiku-4-5",
  "providerID": "anthropic",
  "mode": "explore",
  "agent": "explore",
  "tokens": {
    "input": 3,
    "output": 421,
    "reasoning": 0,
    "cache": { "read": 0, "write": 5445 }
  }
}
```

**Part JSON:**
```json
{
  "id": "prt_xxx",
  "sessionID": "ses_xxx",
  "messageID": "msg_xxx",
  "type": "text",
  "text": "Content"
}
```

### Test Coverage (19 tests)
- **sessionParser**: 6 tests (parse, get, list, XDG_DATA_HOME, error handling)
- **messageParser**: 4 tests (parse, get, list, missing tokens)
- **partParser**: 3 tests (parse, get, lazy loading)
- **boulderParser**: 6 tests (parse boulder, parse plan, checkbox counting, empty plan)

### Key Patterns
- **Graceful error handling**: All parsers return null on error, never throw
- **XDG compliance**: Respect XDG_DATA_HOME environment variable
- **Lazy loading**: Part parser only loads on demand (critical for 25K+ files)
- **Type safety**: Internal JSON interfaces map to shared types
- **Path handling**: Convert relative paths to absolute in boulder parser
- **Regex for checkboxes**: `/-\s+\[([ xX])\]\s*(.+)/g` matches both [x] and [X]

### Next Steps (Task 5)
- Log parser will use similar patterns for parsing log files
- Watcher will use these parsers to load storage on startup
- State manager will cache parsed data in RingBuffer

### Notes
- All tests pass: `bun test src/server/storage/__tests__/` → 19 pass
- Acceptance criteria verified: parseSession correctly handles parentID
- No caching implemented (Task 8 will add caching layer)
- No watch functionality (separate task)

## Task 6: Hono Server Setup (2026-01-31)

### Approach
- Used Hono framework for lightweight HTTP server
- Port 50234 (matching reference repo oh-my-opencode-dashboard)
- All routes implemented as stubs returning empty/null data
- CORS configured for localhost only (restrictive)
- Static file serving configured for client build (src/client/dist/)

### Testing Strategy
- Initially tried live server tests (failed - server not running during test)
- Switched to Hono's built-in test approach using `app.fetch(req)`
- Exported `app` separately from default export for testing
- Tests now run without requiring live server

### Key Decisions
- Separate `export { app }` for testing vs default export for Bun server
- Used Hono's Request/Response API directly in tests
- All routes return appropriate empty data types ([], {}, null)
- Health endpoint returns `{status: "ok"}` for monitoring

### Files Created
- src/server/index.ts (67 lines)
- src/server/__tests__/routes.test.ts (67 lines)
- bun.lock (dependency lockfile)

### Dependencies Added
- hono@4.11.7

### Test Results
- 8 route tests passing
- All endpoints return 200 status
- Health check verified manually via curl

## Task 8: File Watcher + Dirty-Flag Cache (2026-01-31)

### Implementation Details
- **Cache Pattern**: Dirty-flag with 2s TTL (matches oh-my-opencode-dashboard reference)
- **Watcher**: fs.watch() on session/ (recursive) and message/ (non-recursive)
- **Debouncing**: 100ms to handle rapid file changes
- **Directory Structure**: session/{projectID}/{sessionID}.json, message/{messageID}.json

### Key Decisions
1. **Skip part/ directory**: 25k+ files would overwhelm fs.watch()
2. **Singleton cache**: Exported instance for use across API endpoints
3. **EventEmitter pattern**: Watcher emits 'change', 'started', 'stopped' events
4. **Graceful degradation**: Cache returns stale data if recompute fails

### Testing Insights
- **Timing**: macOS fs.watch() needs 50-200ms delay for reliable event detection
- **Directory structure**: Tests must create proper subdirectories (projectID) for recursive watching
- **Debounce verification**: Multiple rapid writes should trigger only one change event

### Integration Points
- Cache exports singleton instance: `import { cache } from './cache'`
- Watcher factory: `createWatcher(storagePath?: string): Watcher`
- Cache methods: `getSessions(projectID)`, `getMessages(sessionID)`, `markDirty()`
- Watcher events: `on('change', handler)`, `on('started', handler)`, `on('stopped', handler)`

### Next Steps (Task 9)
- Wire watcher to cache: `watcher.on('change', () => cache.markDirty())`
- Implement /api/poll endpoint using cache
- Add watcher lifecycle to server startup/shutdown

## Task 7: Session API Endpoints Implementation

### What Worked Well
- **Storage Parser Integration**: The storage parsers from Task 4 worked seamlessly with the API endpoints
- **Type Safety**: TypeScript interfaces for TreeNode, TreeEdge, and SessionTree provided clear contracts
- **Test-First Approach**: Writing comprehensive tests (17 tests) caught edge cases early
- **Helper Functions**: Extracting `buildAgentHierarchy()` and `buildSessionTree()` kept endpoints clean
- **Error Handling**: 404 responses for non-existent sessions provide clear feedback

### Key Patterns
1. **Session Filtering**: Filter by 24h window, then sort by updatedAt, then limit to 20
2. **Active Detection**: Session is active if last message < 5 minutes ago
3. **Tree Building**: Recursive function with visited set prevents infinite loops
4. **Agent Hierarchy**: Build from message.parentID relationships, not session.parentID
5. **Type Assertions in Tests**: Use `as any[]` for Bun test framework compatibility

### Implementation Details
- **GET /api/sessions**: Returns sessions from last 24h OR last 20 (whichever fewer)
- **GET /api/sessions/:id**: Includes full session + agent hierarchy from messages
- **GET /api/sessions/:id/messages**: Returns last 100 messages, sorted newest first
- **GET /api/sessions/:id/tree**: React Flow format with nodes/edges for visualization
- **GET /api/projects**: Lists unique projectIDs with directory paths and session counts

### Performance Considerations
- `listAllSessions()` loads all sessions across all projects - could be slow with many projects
- Each session in `/api/sessions` loads messages to check isActive - N+1 query pattern
- Tree building is recursive and could be deep for long session chains
- Projects endpoint calls `listAllSessions()` for each project - inefficient

### Future Optimizations (for Task 8 caching)
- Cache `listAllSessions()` result with TTL
- Batch message loading for isActive checks
- Index sessions by projectID to avoid full scans
- Memoize tree building results

### Test Coverage
- All endpoints return correct data structures
- 404 handling for non-existent sessions
- Sorting and limiting work correctly
- Empty state handling (no sessions/messages)
- Tree structure validation (nodes have id/data, edges have source/target)

### Gotchas
- LSP shows type errors in test file even with type assertions - Bun test framework quirk
- `getSession()` import was unused - removed to clean up hints
- Session.parentID is undefined in OpenCode storage - only messages have parentID
- Tree edges use session.parentID, but agent hierarchy uses message.parentID

