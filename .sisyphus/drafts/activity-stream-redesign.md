# Draft: Activity Stream Redesign

## Problems Identified (from code review + user feedback)

1. **Raw Log Dump** — Every tool call is its own row. 5 file reads = 5 rows of noise. No semantic grouping.
2. **Reordering/Jank** — `AnimatePresence mode="popLayout"` + `layout` on parent + child + 2s full re-synthesis = visible jank. Items shift positions as new data arrives.
3. **Bulk Updates** — 10-15 events arrive every 2s poll. Wall of new rows appears instantly.
4. **Useless Expansion** — Expanding shows raw JSON input. For a "read" call, that's just `{"filePath": "..."}` — already in the summary.
5. **No Visual Hierarchy** — Agent spawn, agent complete, and tool-call #47 all have identical visual weight.

## Oracle Recommendations (key takeaways)

- **Two-level model**: Milestones (spawn/complete/error) vs Collapsed Work Bursts (routine tool calls)
- **Burst grouping**: Same agent + <=4s gap + max ~8 events. Summary: `read x3, grep x1, edit x1 (9s)`
- **Visual weight tiers**: Milestones=strong, burst headers=medium, burst internals=muted
- **Incremental merge**: Replace full re-synthesis with stable-key diffing. Remove layout animations.
- **Queued reveal**: Buffer batch arrivals, release every ~150ms or show `+N new events` chip
- **Redesigned expansion**: Burst → typed fields (path/pattern/command), not raw JSON. Raw JSON only under "Advanced" disclosure.

## Technical Context

- **Files affected**: `ActivityStream.tsx`, `ActivityRow.tsx`, `activityUtils.ts`, types
- **Data flow**: `/api/poll` (2s) → `activitySessions` → `synthesizeActivityItems()` → `ActivityItem[]` → components
- **Motion lib**: `motion/react` (framer-motion)
- **Current types**: ToolCallActivity, AgentSpawnActivity, AgentCompleteActivity

## Decisions Made

- **Scope**: Full redesign (not incremental)
- **Collapse strategy**: Aggressive — all consecutive same-agent tool calls in one burst. Break only on agent change, error, or milestone.
- **New features**: Per-agent swimlanes + Milestones-only mode toggle
- **Approach**: Two-level model (milestones + bursts), visual hierarchy, incremental diffing, queued reveal

- **Swimlane integration**: Tab toggle — "Stream" (default) and "Agents" tabs at top of panel
- **Test strategy**: TDD (RED-GREEN-REFACTOR) using existing bun test (server/utils) + vitest (client components)

## Open Questions
(none remaining)
