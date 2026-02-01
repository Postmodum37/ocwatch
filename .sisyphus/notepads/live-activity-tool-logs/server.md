
## Task: Server-side tool call aggregation

### Implementation Summary
- Created `getToolCallsForSession()` in `src/server/storage/partParser.ts`
- Integrated tool calls into poll endpoint's activitySessions
- Added comprehensive test coverage in `partParser.test.ts`

### Key Patterns Learned

**TDD Approach:**
1. Write failing tests first (RED)
2. Implement minimal code to pass (GREEN)
3. Refactor while keeping tests green (REFACTOR)

**Tool Call Aggregation:**
- Filter parts for `type === "tool"` only
- Build messageAgent map: `Map<messageID, agentName>`
- Sort by timestamp descending (newest first)
- Limit to 50 most recent items

**Timestamp Handling:**
- Added `startedAt` field to PartMeta for pending tool calls
- Use `completedAt || startedAt` as fallback for stable ETag hashing
- Empty string fallback only when both are unavailable
- **Critical:** Avoid using `new Date()` in timestamp generation - it breaks ETag caching

**State Mapping:**
- "pending", "running", "in_progress" → "pending"
- "error", "failed" → "error"
- All others → "complete"

### Test Coverage
- 23 tests for partParser functions
- Tests cover: structure, filtering, sorting, limits, state mapping, empty sessions
- All tests passing ✓

### Integration Points
- Poll endpoint builds messageAgent map from session messages
- Tool calls added to ActivitySession objects in both:
  - Single-phase sessions (getSessionHierarchy)
  - Child sessions (processChildSession)

### Issues Encountered
1. **ETag cache invalidation:** Initial implementation used `new Date()` for missing timestamps, breaking cache
   - **Fix:** Use `startedAt` as stable fallback
2. **Test timeouts:** Transient issue when running all tests together
   - **Resolution:** Tests pass when run individually and in subsequent runs

### Performance Considerations
- Uses existing `getPartsForSession()` (lazy loading per message)
- No full part/ directory scan (25k+ files)
- 50 item limit prevents unbounded growth
