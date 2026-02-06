# Waiting-User UI Enhancement & Browser Notifications

## TL;DR

> **Quick Summary**: Make the "waiting for user input" state unmissable with prominent amber animations and a descriptive icon, plus add browser notifications for agent completion and input-needed transitions so the user never misses an event.
> 
> **Deliverables**:
> - Redesigned waiting-user indicator in LiveActivity panel (amber MessageCircleQuestion + glow)
> - Redesigned waiting-user indicator in SessionList sidebar (animated glow + descriptive text)
> - New `useNotifications` hook with state-transition diffing and browser Notification API
> - Integration into AppProvider with a bell-icon enable button in the header
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (animations) → Task 2 (LiveActivity UI) + Task 3 (SessionList UI) → Task 4 (useNotifications hook) → Task 5 (integration)

---

## Context

### Original Request
Two features for the OCWatch real-time monitoring dashboard:
1. **Better "waiting for input" UI** — When activityType is "waiting-user", make it UNMISSABLE with prominent visual treatment. Currently shows a tiny gray circle icon that's nearly invisible.
2. **Browser notifications** — Send a browser notification when agent finishes work or waits for user input. Only on state transitions, not every poll cycle.

### Interview Summary
**Key Discussions**:
- Current `ActivityTypeIndicator` in LiveActivity.tsx (line 119-124) renders waiting-user as `<Circle className="w-3 h-3 text-gray-400">` — essentially invisible against the dark background
- Current `SessionStatusIcon` in SessionList.tsx (line 30-31) shows `<Clock className="w-4 h-4 text-warning">` — small but has some color
- `animations.css` already has `animate-attention` class (amber glow keyframes, lines 98-110) but it's UNUSED
- No notification logic exists anywhere in the codebase
- Data flow: SSE events → debounced fetch → PollResponse → AppContext → Components
- User explicitly wants notifications only on state TRANSITIONS, not repeated notifications for ongoing states

**Research Findings**:
- `lucide-react` already installed — `MessageCircleQuestion` icon available
- Tailwind `warning` color `#d29922` (amber) already defined
- `animate-attention` keyframes already exist but use `inset 2px 0 0` box-shadow — this conflicts with `border-l-2 border-l-warning` already on SessionList items (they visually stack at 4px)
- `useSSE` already tracks `document.visibilityState` for reconnection — can reuse pattern for notification suppression
- Notification API `tag` option provides native deduplication — same tag replaces previous notification
- `sessions[]` array (from PollResponse) is the correct source for transition tracking since it contains root sessions
- `activitySessions[]` includes subagents which should NOT trigger notifications

### Metis Review
**Identified Gaps** (addressed):
- **First-poll false positives**: On page load, prevState is empty → all existing waiting-user sessions would fire notifications. Fixed: Use `null` ref for first load, skip diffing on first render.
- **SSE reconnection flooding**: After reconnect, state may have diverged significantly causing false transitions. Fixed: Reset baseline when `isReconnecting` clears.
- **Border + inset shadow stacking**: `border-l-warning` + `animate-attention` (inset box-shadow) would stack at 4px. Fixed: Replace border approach with animation-only for waiting-user items.
- **Subagent completion spam**: 5 explore agents completing = 5 notifications. Fixed: Only track root sessions (parentID is undefined/null).
- **Rapid state oscillation**: Agent flipping between working/waiting quickly. Fixed: Per-session cooldown of 10s minimum.
- **Multiple tabs**: Two OCWatch tabs would fire duplicate notifications. Fixed: `tag` with session ID handles this natively.
- **Permission denied permanently**: Once denied, can't re-prompt. Fixed: Check permission state, show in-app guidance if denied.

---

## Work Objectives

### Core Objective
Make the "waiting for user input" state visually dominant in both the sidebar and main panel, and add browser notifications that fire exactly once per state transition when the tab is not visible.

### Concrete Deliverables
- Modified `ActivityTypeIndicator` in `LiveActivity.tsx` — amber `MessageCircleQuestion` with animate-attention glow
- Modified `SessionStatusIcon` and session item styling in `SessionList.tsx` — animated amber glow
- New CSS animation in `animations.css` — enhanced waiting-user row background pulse
- New hook `src/client/src/hooks/useNotifications.ts` — transition detection + Notification API
- Modified `AppContext.tsx` — calls `useNotifications` hook
- Notification enable UI — small bell icon button in the app header

### Definition of Done
- [ ] All waiting-user indicators use amber `MessageCircleQuestion` icon with animate-attention glow
- [ ] Gray Circle icon is completely removed from waiting-user rendering
- [ ] SessionList waiting-user items have animated amber glow background
- [ ] Browser notification fires once when a root session transitions TO `waiting-user`
- [ ] Browser notification fires once when a root session transitions FROM `working` TO `completed`
- [ ] No notification fires when tab is visible
- [ ] No notification fires on initial page load
- [ ] No notification fires for subagent transitions
- [ ] All existing tests pass: `cd src/client && bun run test` and `bun test`

### Must Have
- Amber animated glow on waiting-user items in BOTH sidebar and main panel
- `MessageCircleQuestion` icon (lucide) replacing the gray Circle
- Notification API with `tag`-based deduplication per session
- Page Visibility API suppression (no notifications when tab visible)
- Null-ref baseline initialization (skip first poll diff)
- Per-session 10s cooldown to prevent rapid-fire spam
- SSE reconnection baseline reset

### Must NOT Have (Guardrails)
- ❌ Notification settings/preferences UI (beyond enable/disable bell icon)
- ❌ Notification history panel or queue
- ❌ Notifications for subagent transitions (only root sessions where `parentID` is falsy)
- ❌ Notifications for `idle` or generic `waiting` status — ONLY `waiting-user` and `working→completed`
- ❌ ServiceWorker for notifications (Notification API directly)
- ❌ Sound configuration options
- ❌ Favicon badge/indicator changes
- ❌ Any server-side code modifications
- ❌ localStorage persistence of notification preference (browser handles permission)
- ❌ New npm dependencies
- ❌ Changes to any non-waiting-user status indicators

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> ALL tasks are verifiable WITHOUT any human action.

### Test Decision
- **Infrastructure exists**: YES (Vitest for client, bun test for server)
- **Automated tests**: YES (tests-after for the useNotifications hook)
- **Framework**: Vitest (client)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Every task includes specific QA scenarios. The executing agent directly verifies each deliverable by running commands, checking DOM, and grepping code — no human needed.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Add enhanced CSS animations for waiting-user

Wave 2 (After Wave 1):
├── Task 2: Redesign waiting-user indicator in LiveActivity.tsx
└── Task 3: Redesign waiting-user indicator in SessionList.tsx

Wave 3 (After Wave 2):
└── Task 4: Create useNotifications hook

Wave 4 (After Wave 3):
└── Task 5: Integrate notifications into AppProvider + add bell icon UI
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3 | None |
| 2 | 1 | 4 | 3 |
| 3 | 1 | 4 | 2 |
| 4 | 2, 3 | 5 | None |
| 5 | 4 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1 | `category="quick"` |
| 2 | 2, 3 | `category="quick"` (parallel) |
| 3 | 4 | `category="unspecified-high"` |
| 4 | 5 | `category="quick"` |

---

## TODOs

- [ ] 1. Add enhanced CSS animations for waiting-user state

  **What to do**:
  - Add a new `@keyframes waiting-user-row-pulse` animation in `animations.css` for a subtle amber background pulse on waiting-user session rows (use `rgba(210, 153, 34, 0.06)` → `rgba(210, 153, 34, 0.12)` → `rgba(210, 153, 34, 0.06)`, 2s ease-in-out infinite)
  - Add a new `.animate-waiting-user-row` utility class for this keyframe
  - The existing `animate-attention` class (lines 108-110) already provides an amber glow and will be used on icon containers — do NOT modify it
  - Add a new `@keyframes waiting-user-icon-pulse` for icon-level attention: scale + opacity pulse (scale 1→1.15→1, opacity 0.8→1→0.8, 1.5s infinite)
  - Add `.animate-waiting-user-icon` utility class

  **Must NOT do**:
  - Do NOT modify the existing `animate-attention`, `animate-badge-glow`, or any other existing keyframes
  - Do NOT add Tailwind config changes — use raw CSS animations only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file edit, CSS-only, no logic complexity
  - **Skills**: `[]`
    - No special skills needed for CSS edits

  **Parallelization**:
  - **Can Run In Parallel**: NO (Wave 1, foundation)
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/client/src/styles/animations.css:48-66` — Existing `badge-glow` keyframe pattern to follow (keyframe definition + utility class)
  - `src/client/src/styles/animations.css:84-96` — `session-update-pulse` pattern for background pulse animations
  - `src/client/src/styles/animations.css:98-110` — Existing `attention-glow` keyframe (amber colors) — DO NOT MODIFY, just reference for color values

  **WHY Each Reference Matters**:
  - `badge-glow` (lines 48-66): Follow same structure of `@keyframes` + `.animate-` class pair. The badge-glow uses `var(--badge-color)` CSS custom property pattern — the new animations should use hardcoded amber values since they're always warning-colored.
  - `session-update-pulse` (lines 84-96): This is the pattern for background-color animation on rows — the new `waiting-user-row-pulse` should follow this exact structure but with amber instead of blue.
  - `attention-glow` (lines 98-110): Reference only for the exact amber color values (`rgba(210, 153, 34, 0.6)` and `rgba(210, 153, 34, 1)`). This class will be used as-is on icon containers.

  **Acceptance Criteria**:
  - [ ] `animations.css` contains `@keyframes waiting-user-row-pulse` with amber background pulse
  - [ ] `animations.css` contains `.animate-waiting-user-row` class
  - [ ] `animations.css` contains `@keyframes waiting-user-icon-pulse` with scale+opacity pulse
  - [ ] `animations.css` contains `.animate-waiting-user-icon` class
  - [ ] Existing keyframes (`attention-glow`, `badge-glow`, `pulse-bg`, etc.) are UNCHANGED

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: New animation classes exist in CSS
    Tool: Bash (grep)
    Preconditions: File src/client/src/styles/animations.css exists
    Steps:
      1. grep "waiting-user-row-pulse" src/client/src/styles/animations.css
      2. Assert: At least 2 matches (keyframe + class)
      3. grep "waiting-user-icon-pulse" src/client/src/styles/animations.css
      4. Assert: At least 2 matches (keyframe + class)
      5. grep "animate-waiting-user-row" src/client/src/styles/animations.css
      6. Assert: 1 match (class definition)
      7. grep "animate-waiting-user-icon" src/client/src/styles/animations.css
      8. Assert: 1 match (class definition)
    Expected Result: All four new animation artifacts are present
    Failure Indicators: Zero matches for any grep

  Scenario: Existing animations are untouched
    Tool: Bash (grep)
    Preconditions: File exists
    Steps:
      1. grep -c "@keyframes attention-glow" src/client/src/styles/animations.css
      2. Assert: Exactly 1 match
      3. grep -c "@keyframes badge-glow" src/client/src/styles/animations.css
      4. Assert: Exactly 1 match
      5. grep -c "animate-attention" src/client/src/styles/animations.css
      6. Assert: Exactly 1 match (the class definition)
    Expected Result: Existing keyframes remain intact
    Failure Indicators: Count differs from expected
  ```

  **Commit**: YES
  - Message: `feat(ui): add waiting-user CSS animations for row pulse and icon pulse`
  - Files: `src/client/src/styles/animations.css`

---

- [ ] 2. Redesign waiting-user indicator in LiveActivity.tsx

  **What to do**:
  - Import `MessageCircleQuestion` from `lucide-react` (add to existing import line 2)
  - Replace the `waiting-user` case in `ActivityTypeIndicator` (lines 119-124) with:
    - Outer span: `className="flex items-center gap-1.5 text-warning animate-waiting-user-icon"` (amber color + icon pulse)
    - Icon: `<MessageCircleQuestion className="w-4 h-4" />` (bumped from w-3 h-3 to w-4 h-4 for visibility)
    - Text label: `<span className="text-xs font-medium">Needs input</span>` (descriptive text)
    - Title: `"Waiting for your input"` instead of `"Waiting for user"`
  - In `SessionRow` (lines 151-233): When `session.activityType === 'waiting-user'`, add `animate-waiting-user-row` class to the row container div (line 169). This gives the whole row an amber background pulse.
  - Update the `currentActionText` logic: when `activityType === 'waiting-user'` and `currentAction` is the generic "question", replace with "Waiting for your response" for better descriptiveness.

  **Must NOT do**:
  - Do NOT modify StatusIndicator component (lines 52-86) — it handles `status` not `activityType`
  - Do NOT modify any other `activityType` cases (reasoning, patch, tool, waiting-tools)
  - Do NOT change icon sizes for non-waiting-user indicators
  - Do NOT add new props to ActivityTypeIndicator

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Targeted edits in a single file, clear before/after, no architectural changes
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3)
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/client/src/components/LiveActivity.tsx:52-65` — `StatusIndicator` working state with `animate-badge-glow` — follow this pattern for adding animation class to the icon container
  - `src/client/src/components/LiveActivity.tsx:99-104` — `patch` case in ActivityTypeIndicator — follow this pattern for icon + text label (uses `<FileEdit>` icon + count span)
  - `src/client/src/components/LiveActivity.tsx:167-170` — SessionRow container div with conditional classes — add `animate-waiting-user-row` class here conditionally

  **API/Type References**:
  - `src/shared/types/index.ts:46` — `SessionActivityType` type definition — confirms `"waiting-user"` is a valid value

  **External References**:
  - `lucide-react` — `MessageCircleQuestion` icon: question mark inside a message bubble. More semantically meaningful than `Circle` for "waiting for user input".

  **WHY Each Reference Matters**:
  - StatusIndicator working state (lines 52-65): Shows the established pattern of wrapping an icon in a span with an animation class (`animate-badge-glow`). The waiting-user case should follow the same container+icon+animation pattern.
  - Patch case (lines 99-104): Shows how to combine an icon with a text label (`<FileEdit>` + count). The waiting-user case should follow this for icon + "Needs input" text.
  - SessionRow container (lines 167-170): Shows where to add conditional className for the row-level background animation.

  **Acceptance Criteria**:
  - [ ] `MessageCircleQuestion` imported in LiveActivity.tsx
  - [ ] ActivityTypeIndicator waiting-user case renders `MessageCircleQuestion` icon (not `Circle`)
  - [ ] Icon uses `text-warning` color class (amber)
  - [ ] Icon container has `animate-waiting-user-icon` class
  - [ ] "Needs input" text label visible next to icon
  - [ ] SessionRow gets `animate-waiting-user-row` class when activityType is `waiting-user`
  - [ ] No gray Circle icon remains for waiting-user: `grep -n "Circle.*waiting-user\|waiting-user.*Circle" src/client/src/components/LiveActivity.tsx` returns 0 matches
  - [ ] Existing client tests pass: `cd src/client && bun run test`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Gray Circle icon completely removed from waiting-user
    Tool: Bash (grep)
    Preconditions: LiveActivity.tsx has been modified
    Steps:
      1. grep -n "text-gray-400" src/client/src/components/LiveActivity.tsx
      2. Assert: No matches in the waiting-user case area (lines ~119-128)
      3. Search for the exact old code pattern: grep "Circle.*w-3.*text-gray" src/client/src/components/LiveActivity.tsx
      4. Assert: 0 matches
    Expected Result: Old gray Circle is completely gone
    Failure Indicators: Any grep match

  Scenario: MessageCircleQuestion icon present for waiting-user
    Tool: Bash (grep)
    Preconditions: LiveActivity.tsx has been modified
    Steps:
      1. grep "MessageCircleQuestion" src/client/src/components/LiveActivity.tsx
      2. Assert: At least 2 matches (import + usage)
      3. grep "animate-waiting-user-icon" src/client/src/components/LiveActivity.tsx
      4. Assert: At least 1 match
      5. grep "Needs input" src/client/src/components/LiveActivity.tsx
      6. Assert: At least 1 match
    Expected Result: New icon, animation, and label text all present
    Failure Indicators: Zero matches for any grep

  Scenario: SessionRow has conditional row animation
    Tool: Bash (grep)
    Preconditions: LiveActivity.tsx has been modified
    Steps:
      1. grep "animate-waiting-user-row" src/client/src/components/LiveActivity.tsx
      2. Assert: At least 1 match in the SessionRow component area
    Expected Result: Row-level amber background pulse applied conditionally
    Failure Indicators: Zero matches

  Scenario: Existing tests still pass
    Tool: Bash
    Preconditions: Node modules installed
    Steps:
      1. cd src/client && bun run test -- --run 2>&1
      2. Assert: Exit code 0
      3. Assert: Output contains "pass" and no "fail"
    Expected Result: All existing tests green
    Failure Indicators: Non-zero exit code or test failures
  ```

  **Commit**: YES (groups with Task 3)
  - Message: `feat(ui): redesign waiting-user indicators with prominent amber animations`
  - Files: `src/client/src/components/LiveActivity.tsx`, `src/client/src/components/SessionList.tsx`
  - Pre-commit: `cd src/client && bun run test -- --run`

---

- [ ] 3. Redesign waiting-user indicator in SessionList.tsx

  **What to do**:
  - Import `MessageCircleQuestion` from `lucide-react` (add to existing import on line 2)
  - Replace `SessionStatusIcon` waiting-user case (lines 30-31): Change from `<Clock className="w-4 h-4 text-warning">` to `<MessageCircleQuestion className="w-4 h-4 text-warning animate-waiting-user-icon" />` — same icon as LiveActivity for consistency, with pulse animation
  - Modify session item border/glow for waiting-user (lines 148-156): Replace `border-l-warning` with `animate-attention` class for the waiting-user case. The `animate-attention` keyframe already produces an animated amber left inset glow, which is more attention-grabbing than a static border. Remove the static `border-l-warning` to prevent visual stacking.
  - Update the `currentAction` display text (line 184-185): When `activityType === 'waiting-user'` and `currentAction` is the generic "question", display "⚡ Needs your input" instead

  **Must NOT do**:
  - Do NOT change any other session status cases (working, idle, completed, generic waiting)
  - Do NOT modify the session list sorting, filtering, or selection logic
  - Do NOT add new props to SessionStatusIcon
  - Do NOT modify the sidebar widgets section

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Targeted edits in a single file, mirrors the LiveActivity changes
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2)
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/client/src/components/SessionList.tsx:20-37` — `SessionStatusIcon` component — the exact component to modify. The working case (line 22) with `animate-spin` shows the pattern for adding animation classes to icons.
  - `src/client/src/components/SessionList.tsx:148-156` — Border class logic for session items — the exact conditional to modify. Currently uses `border-l-warning` for waiting-user.
  - `src/client/src/components/SessionList.tsx:166-169` — Session item button with border classes — this is where `animate-attention` gets applied
  - `src/client/src/components/SessionList.tsx:183-186` — currentAction text display area

  **Animation References**:
  - `src/client/src/styles/animations.css:98-110` — `animate-attention` class — this is the animation to apply to waiting-user session items (replaces static `border-l-warning`). Uses `box-shadow: inset 2px 0 0 rgba(210, 153, 34, ...)` for an animated left-side amber glow.

  **WHY Each Reference Matters**:
  - `SessionStatusIcon` (lines 20-37): This is the exact component being modified. The `animate-spin` on working status (line 22) shows how animation classes are added to icons.
  - Border class logic (lines 148-156): This is the exact conditional block. We replace `border-l-warning` with `animate-attention` for the waiting-user case. Important: we must also ensure `border-l-transparent` (or no border-l) is set alongside animate-attention to prevent double left indicators.
  - `animate-attention` (animations.css:98-110): The inset box-shadow replaces the static border-l. Using animation instead of static border makes it pulse and catch the eye.

  **Acceptance Criteria**:
  - [ ] `MessageCircleQuestion` imported in SessionList.tsx
  - [ ] SessionStatusIcon renders `MessageCircleQuestion` for waiting-user (not `Clock`)
  - [ ] Icon has `animate-waiting-user-icon` class for pulse effect
  - [ ] Session item uses `animate-attention` class for waiting-user rows (not static `border-l-warning`)
  - [ ] No static `border-l-warning` applied simultaneously with `animate-attention`
  - [ ] "Needs your input" text shown instead of generic "question" for waiting-user currentAction
  - [ ] Existing client tests pass: `cd src/client && bun run test -- --run`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: SessionStatusIcon uses MessageCircleQuestion for waiting-user
    Tool: Bash (grep)
    Preconditions: SessionList.tsx modified
    Steps:
      1. grep "MessageCircleQuestion" src/client/src/components/SessionList.tsx
      2. Assert: At least 2 matches (import + usage)
      3. grep -c "Clock.*waiting-user\|waiting-user.*Clock" src/client/src/components/SessionList.tsx
      4. Assert: 0 matches (Clock no longer used for waiting-user)
    Expected Result: New icon replaces old Clock for waiting-user
    Failure Indicators: Clock still referenced in waiting-user context

  Scenario: animate-attention replaces static border for waiting-user
    Tool: Bash (grep)
    Preconditions: SessionList.tsx modified
    Steps:
      1. grep "animate-attention" src/client/src/components/SessionList.tsx
      2. Assert: At least 1 match (in the border class conditional)
      3. Verify no simultaneous border-l-warning + animate-attention on same element
    Expected Result: Dynamic amber glow replaces static amber border
    Failure Indicators: Zero matches for animate-attention

  Scenario: Descriptive text for waiting-user sessions
    Tool: Bash (grep)
    Preconditions: SessionList.tsx modified
    Steps:
      1. grep "Needs your input" src/client/src/components/SessionList.tsx
      2. Assert: At least 1 match
    Expected Result: User-friendly text instead of generic "question"
    Failure Indicators: Zero matches
  ```

  **Commit**: YES (groups with Task 2 — same commit)
  - Message: `feat(ui): redesign waiting-user indicators with prominent amber animations`
  - Files: `src/client/src/components/LiveActivity.tsx`, `src/client/src/components/SessionList.tsx`
  - Pre-commit: `cd src/client && bun run test -- --run`

---

- [ ] 4. Create useNotifications hook with state-transition detection

  **What to do**:
  - Create new file `src/client/src/hooks/useNotifications.ts`
  - Implement a `useNotifications` hook that:
    1. **Tracks permission state**: `useState<NotificationPermission>` initialized from `Notification.permission` (or `'denied'` if API unsupported)
    2. **Exposes `requestPermission()`**: Async function to call `Notification.requestPermission()`. Use try/catch with callback fallback for Safari compatibility. Only callable when permission is `'default'`.
    3. **Tracks previous session state**: `useRef<SessionMetadata[] | null>(null)` — `null` means first load (skip diffing), empty array `[]` is valid "no sessions" state
    4. **Accepts current sessions array**: Hook signature: `useNotifications(sessions: SessionMetadata[], isReconnecting: boolean)`
    5. **Diffs prev vs current sessions on every update** (in a `useEffect` watching `sessions`):
       - Build a `Map<sessionId, {status, activityType}>` for both prev and current
       - For each session in current: check if it exists in prev AND has a different status/activityType
       - **Transition 1**: Any session where `activityType` changed TO `'waiting-user'` (was NOT `'waiting-user'` before, or session is new AND was previously tracked as non-waiting-user) — AND `parentID` is falsy (root session only)
       - **Transition 2**: Any session where `status` changed FROM `'working'` TO `'completed'` — AND `parentID` is falsy (root session only)
       - Sessions that exist in prev but not current: ignore (they dropped off, not a transition)
       - Sessions that are new (not in prev): ignore (they're being loaded for the first time)
    6. **Fires Notification API** for detected transitions:
       - Waiting-user: `new Notification("🔔 Input needed", { body: "${agent} is waiting for your response", tag: "ocwatch-waiting-${sessionId}", requireInteraction: false })`
       - Completed: `new Notification("✅ Agent completed", { body: "${agent} finished work", tag: "ocwatch-completed-${sessionId}", requireInteraction: false })`
    7. **Suppresses when tab is visible**: Check `document.visibilityState !== 'visible'` before firing. If visible, skip notification (user is already seeing the dashboard).
    8. **Per-session cooldown**: `useRef<Map<string, number>>` tracking last notification timestamp per session ID. Skip if last notification for that session was < 10 seconds ago.
    9. **SSE reconnection reset**: When `isReconnecting` transitions from `true` to `false`, set prevRef to current sessions (skip diffing that cycle) to prevent false-positive floods.
    10. **Returns**: `{ permission, requestPermission, enabled }` where `enabled = permission === 'granted'`
  - Create test file `src/client/src/__tests__/useNotifications.test.ts`:
    - Test: First render with existing waiting-user sessions does NOT fire notifications
    - Test: Transition from working → waiting-user fires notification
    - Test: Transition from working → completed fires notification  
    - Test: No notification when tab is visible (mock `document.visibilityState`)
    - Test: No notification for subagent transitions (session with parentID)
    - Test: Cooldown prevents rapid-fire (same session within 10s)
    - Test: SSE reconnection resets baseline (no false positives)

  **Must NOT do**:
  - Do NOT create a React Context/Provider for notifications — just a hook
  - Do NOT add ServiceWorker registration
  - Do NOT persist notification preferences to localStorage
  - Do NOT add notification sound configuration
  - Do NOT fire notifications for `idle`, `working`, or generic `waiting` transitions
  - Do NOT track `activitySessions[]` — use `sessions[]` only

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Non-trivial logic with state diffing, edge cases (reconnection, cooldown, baseline), and test writing. Requires careful implementation.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 2, 3 (UI should be done first so testing is visual-complete)

  **References**:

  **Pattern References**:
  - `src/client/src/hooks/useSSE.ts:1-19` — Hook structure pattern: import style, interface definitions, export function signature. Follow this exact file structure.
  - `src/client/src/hooks/useSSE.ts:84-95` — `document.visibilityState` handling pattern with `visibilitychange` event listener. Reuse this exact approach for notification suppression.
  - `src/client/src/hooks/useSSE.ts:40-43` — `useRef` pattern for tracking mutable state across renders without triggering re-renders. Follow for prevSessionsRef and cooldownRef.
  - `src/client/src/hooks/usePolling.ts:84-174` — `fetchData` callback pattern with abort handling. Shows how to structure complex async logic in hooks with proper cleanup.

  **API/Type References**:
  - `src/shared/types/index.ts:6` — `SessionStatus` type: `"working" | "idle" | "completed" | "waiting"` — the status values to diff
  - `src/shared/types/index.ts:46` — `SessionActivityType` type: includes `"waiting-user"` — the activityType to watch
  - `src/shared/types/index.ts:8-22` — `SessionMetadata` interface: has `id`, `status`, `activityType`, `parentID`, `agent` fields — these are the fields used in diffing

  **Test References**:
  - `src/client/src/__tests__/` — Existing test directory for client tests. Place new test file here.

  **External References**:
  - MDN Notification API: `tag` option for deduplication, `requireInteraction` for auto-dismiss, `Notification.permission` for state checking
  - MDN Page Visibility API: `document.visibilityState`, `visibilitychange` event

  **WHY Each Reference Matters**:
  - `useSSE.ts` structure (lines 1-19): Establishes the exact pattern for hook file organization in this project — TypeScript interfaces first, then exported function. Critical for consistency.
  - `visibilitychange` handler (lines 84-95): This exact pattern (addEventListener in useEffect, cleanup in return) should be reused. Don't reinvent — the project already handles visibility.
  - `SessionMetadata` interface (types:8-22): The `parentID` field is how we filter root sessions (falsy = root). The `agent` field provides the notification body text.

  **Acceptance Criteria**:
  - [ ] File exists: `src/client/src/hooks/useNotifications.ts`
  - [ ] Hook exports `useNotifications` function
  - [ ] Hook accepts `(sessions: SessionMetadata[], isReconnecting: boolean)` parameters
  - [ ] Hook returns `{ permission, requestPermission, enabled }`
  - [ ] First render with waiting-user sessions does NOT fire notification (null ref baseline)
  - [ ] Test file exists: `src/client/src/__tests__/useNotifications.test.ts`
  - [ ] All tests pass: `cd src/client && bun run test -- --run`
  - [ ] All tests pass: `bun test` (server tests unaffected)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Hook file exists with correct exports
    Tool: Bash (grep)
    Preconditions: File created
    Steps:
      1. grep "export function useNotifications" src/client/src/hooks/useNotifications.ts
      2. Assert: 1 match
      3. grep "requestPermission" src/client/src/hooks/useNotifications.ts
      4. Assert: At least 2 matches (declaration + return)
      5. grep "Notification.permission" src/client/src/hooks/useNotifications.ts
      6. Assert: At least 1 match
    Expected Result: Hook has correct structure and exports
    Failure Indicators: Missing exports or API references

  Scenario: State transition diffing logic present
    Tool: Bash (grep)
    Preconditions: File created
    Steps:
      1. grep "prevSessionsRef" src/client/src/hooks/useNotifications.ts
      2. Assert: At least 3 matches (declaration, read, write)
      3. grep "parentID" src/client/src/hooks/useNotifications.ts
      4. Assert: At least 1 match (root session filter)
      5. grep "waiting-user" src/client/src/hooks/useNotifications.ts
      6. Assert: At least 1 match (transition detection)
      7. grep "visibilityState\|document.hidden" src/client/src/hooks/useNotifications.ts
      8. Assert: At least 1 match (suppression logic)
    Expected Result: All key logic patterns present
    Failure Indicators: Missing any core pattern

  Scenario: Cooldown mechanism exists
    Tool: Bash (grep)
    Preconditions: File created
    Steps:
      1. grep "cooldown\|COOLDOWN\|10000\|10_000" src/client/src/hooks/useNotifications.ts
      2. Assert: At least 1 match
    Expected Result: Per-session cooldown prevents spam
    Failure Indicators: No cooldown logic found

  Scenario: Tag-based deduplication in Notification calls
    Tool: Bash (grep)
    Preconditions: File created
    Steps:
      1. grep "tag.*ocwatch" src/client/src/hooks/useNotifications.ts
      2. Assert: At least 1 match
    Expected Result: Notifications use tags for browser-level dedup
    Failure Indicators: No tag usage

  Scenario: Tests exist and pass
    Tool: Bash
    Preconditions: Both hook and test files created
    Steps:
      1. ls src/client/src/__tests__/useNotifications.test.ts
      2. Assert: File exists
      3. cd src/client && bun run test -- --run 2>&1
      4. Assert: Exit code 0
      5. Assert: Output contains test results for useNotifications
    Expected Result: All tests green
    Failure Indicators: Missing test file or test failures

  Scenario: SSE reconnection baseline reset
    Tool: Bash (grep)
    Preconditions: File created
    Steps:
      1. grep "isReconnecting" src/client/src/hooks/useNotifications.ts
      2. Assert: At least 2 matches (parameter + usage)
    Expected Result: Hook handles SSE reconnection to prevent false positives
    Failure Indicators: isReconnecting not referenced
  ```

  **Commit**: YES
  - Message: `feat(notifications): add useNotifications hook with state-transition detection`
  - Files: `src/client/src/hooks/useNotifications.ts`, `src/client/src/__tests__/useNotifications.test.ts`
  - Pre-commit: `cd src/client && bun run test -- --run`

---

- [ ] 5. Integrate notifications into AppProvider and add enable button

  **What to do**:
  - In `src/client/src/store/AppContext.tsx`:
    1. Import `useNotifications` from `../hooks/useNotifications`
    2. Call `useNotifications(data?.sessions || [], isReconnecting)` inside `AppProvider`
    3. Add `notificationPermission` and `requestNotificationPermission` to the `AppContextValue` interface
    4. Pass them through the context value in `useMemo`
  - In `src/client/src/App.tsx` (or wherever the top-level header bar is):
    1. Import `Bell` and `BellOff` icons from `lucide-react`
    2. Add a small bell icon button in the header area
    3. Bell states:
       - `permission === 'default'`: Show `Bell` icon with "Enable notifications" tooltip. On click, call `requestNotificationPermission()`.
       - `permission === 'granted'`: Show `Bell` icon in accent/success color with "Notifications enabled" tooltip. No click action needed.
       - `permission === 'denied'`: Show `BellOff` icon in muted gray with "Notifications blocked — enable in browser settings" tooltip. No click action (browser must re-enable).
    4. Style: small, non-intrusive, consistent with existing header styling (dark theme)
  - Also update the document title when there are waiting-user sessions:
    - When any session has `activityType === 'waiting-user'`, set `document.title = "⚡ Input needed — OCWatch"`
    - When no waiting-user sessions exist, reset to `document.title = "OCWatch"`
    - Implement as a `useEffect` in AppProvider watching the sessions array

  **Must NOT do**:
  - Do NOT create a separate NotificationProvider — use existing AppContext
  - Do NOT add notification preference settings beyond the bell icon
  - Do NOT add a notification log/history panel
  - Do NOT modify the useNotifications hook itself
  - Do NOT add favicon changes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Glue code — importing hook, passing props through context, adding a small icon button
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (final integration task)
  - **Parallel Group**: Wave 4 (solo)
  - **Blocks**: None (final task)
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `src/client/src/store/AppContext.tsx:1-4` — Import pattern for hooks and types
  - `src/client/src/store/AppContext.tsx:6-24` — `AppContextValue` interface — add `notificationPermission` and `requestNotificationPermission` fields here
  - `src/client/src/store/AppContext.tsx:34-42` — Hook call site inside `AppProvider` — call `useNotifications` here alongside `useSSE`
  - `src/client/src/store/AppContext.tsx:78-96` — `useMemo` value object — add notification fields here
  - `src/client/src/App.tsx:2` — lucide-react imports — add `Bell`, `BellOff` here

  **API/Type References**:
  - `src/client/src/hooks/useNotifications.ts` — The hook created in Task 4: `useNotifications(sessions, isReconnecting)` returns `{ permission, requestPermission, enabled }`

  **WHY Each Reference Matters**:
  - `AppContextValue` interface (lines 6-24): This is where new context values are typed. Must add `notificationPermission: NotificationPermission` and `requestNotificationPermission: () => Promise<NotificationPermission>`.
  - Hook call site (lines 34-42): This is where all hooks are called. `useNotifications` must be called here (React rules of hooks — must be at top level of component).
  - `useMemo` value (lines 78-96): All context values must be included in the memo to prevent stale references.
  - `App.tsx` imports (line 2): Bell icons need to be added to existing lucide-react imports.

  **Acceptance Criteria**:
  - [ ] `useNotifications` imported and called in AppProvider
  - [ ] `notificationPermission` exposed via AppContext
  - [ ] `requestNotificationPermission` exposed via AppContext
  - [ ] Bell icon button visible in app header
  - [ ] Bell icon shows correct state for each permission value
  - [ ] Document title changes to "⚡ Input needed — OCWatch" when waiting-user sessions exist
  - [ ] Document title resets to "OCWatch" when no waiting-user sessions
  - [ ] All client tests pass: `cd src/client && bun run test -- --run`
  - [ ] All server tests pass: `bun test`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: useNotifications integrated in AppContext
    Tool: Bash (grep)
    Preconditions: AppContext.tsx modified
    Steps:
      1. grep "useNotifications" src/client/src/store/AppContext.tsx
      2. Assert: At least 2 matches (import + call)
      3. grep "notificationPermission" src/client/src/store/AppContext.tsx
      4. Assert: At least 3 matches (interface + value + memo)
      5. grep "requestNotificationPermission" src/client/src/store/AppContext.tsx
      6. Assert: At least 3 matches (interface + value + memo)
    Expected Result: Hook fully wired into context
    Failure Indicators: Missing integration points

  Scenario: Bell icon in App header
    Tool: Bash (grep)
    Preconditions: App.tsx modified
    Steps:
      1. grep "Bell" src/client/src/App.tsx
      2. Assert: At least 2 matches (import + usage)
      3. grep "requestNotificationPermission\|notificationPermission" src/client/src/App.tsx
      4. Assert: At least 1 match (context consumption)
    Expected Result: Bell icon button wired to notification permission
    Failure Indicators: No Bell references

  Scenario: Document title effect exists
    Tool: Bash (grep)
    Preconditions: AppContext.tsx modified
    Steps:
      1. grep "document.title" src/client/src/store/AppContext.tsx
      2. Assert: At least 2 matches (set + reset)
      3. grep "Input needed" src/client/src/store/AppContext.tsx
      4. Assert: At least 1 match
    Expected Result: Title updates based on waiting-user sessions
    Failure Indicators: No document.title logic

  Scenario: All tests pass after integration
    Tool: Bash
    Preconditions: All modifications complete
    Steps:
      1. cd src/client && bun run test -- --run 2>&1
      2. Assert: Exit code 0
      3. bun test 2>&1
      4. Assert: Exit code 0
    Expected Result: Zero regressions
    Failure Indicators: Any test failure
  ```

  **Commit**: YES
  - Message: `feat(notifications): integrate useNotifications into AppProvider with bell icon toggle`
  - Files: `src/client/src/store/AppContext.tsx`, `src/client/src/App.tsx`
  - Pre-commit: `cd src/client && bun run test -- --run && bun test`

---

## Commit Strategy

| After Task(s) | Message | Key Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(ui): add waiting-user CSS animations for row pulse and icon pulse` | animations.css | grep for new keyframes |
| 2 + 3 | `feat(ui): redesign waiting-user indicators with prominent amber animations` | LiveActivity.tsx, SessionList.tsx | `cd src/client && bun run test -- --run` |
| 4 | `feat(notifications): add useNotifications hook with state-transition detection` | useNotifications.ts, useNotifications.test.ts | `cd src/client && bun run test -- --run` |
| 5 | `feat(notifications): integrate useNotifications into AppProvider with bell icon toggle` | AppContext.tsx, App.tsx | `cd src/client && bun run test -- --run && bun test` |

---

## Success Criteria

### Verification Commands
```bash
# All tests pass
cd src/client && bun run test -- --run  # Expected: 0 failures
bun test                                 # Expected: 0 failures

# No gray Circle for waiting-user
grep -rn "Circle.*gray.*waiting\|waiting.*Circle.*gray" src/client/src/components/  # Expected: 0 matches

# New animations exist
grep -c "waiting-user-row-pulse\|waiting-user-icon-pulse" src/client/src/styles/animations.css  # Expected: 4+

# Notification hook exists with key patterns
grep -c "useNotifications\|prevSessionsRef\|Notification\|visibilityState" src/client/src/hooks/useNotifications.ts  # Expected: 10+

# Integration complete
grep "useNotifications" src/client/src/store/AppContext.tsx  # Expected: 2+ matches
grep "Bell" src/client/src/App.tsx                            # Expected: 2+ matches
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass (client + server)
- [ ] No new npm dependencies added
- [ ] No server-side code modified
