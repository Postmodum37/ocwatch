# OpenCode Storage Model

How OpenCode persists session data to disk and how entities relate to each other.

## The 3 Entities

OpenCode persists everything to `~/.local/share/opencode/storage/` as flat JSON files in three directories:

```
storage/
├── session/{projectID}/{sessionID}.json    <- "the conversation"
├── message/{sessionID}/{messageID}.json    <- "each turn"
└── part/{messageID}/{partID}.json          <- "each action within a turn"
```

The relationship is a strict hierarchy: **Session -> Messages -> Parts**.

---

## 1. Session = "A Conversation"

A session is created when you open OpenCode in a project directory (or when a subagent is spawned). It persists across all your messages -- **writing a new message does NOT create a new session**. The session is the container.

**Real file** (`session/386043c.../{sessionID}.json`):
```json
{
  "id": "ses_3ec7ddb0dffeEx5i93QCLgA74n",
  "projectID": "386043c27ba886538edc95090a732275ede2d4db",
  "directory": "/Users/tomas/Workspace/ocwatch",
  "title": "New session - 2026-01-31T10:03:42.194Z",
  "parentID": null,
  "time": { "created": 1769853822194, "updated": 1769853823891 }
}
```

Key points:
- **`projectID`** = SHA256 hash of the project directory path. All sessions in the same repo share a projectID.
- **`parentID`** = only set when this session was spawned by another session (e.g., `@explore subagent`, `@sisyphus-junior subagent`). Your top-level sessions have no parent.
- **Session persists across messages.** When you send a new message, the session's `time.updated` gets bumped, but no new session file is created.

---

## 2. Message = "One Turn in the Conversation"

Every time you send a message OR the assistant responds, a new message file is created inside the session's message directory.

**Real file** (`message/ses_3c2d19da.../{messageID}.json`):
```json
{
  "id": "msg_c3d2e62540013PG2xMvPM7k34E",
  "sessionID": "ses_3c2d19dadffeV5o7hJ5zjC4qik",
  "role": "user",
  "agent": "explore",
  "model": { "providerID": "github-copilot", "modelID": "claude-haiku-4.5" },
  "parentID": null,
  "finish": null,
  "time": { "created": 1770552975956 }
}
```

**The critical pattern** -- here's what a real conversation looks like inside one session:

```
#   role        finish        parentID
 0  user        -             NONE              <- You type message #1
 1  assistant   stop          -> msg #0         <- Agent responds, done

 2  user        -             NONE              <- You type message #2
 3  assistant   tool-calls    -> msg #2         <- Agent starts working, calls tools
 4  assistant   tool-calls    -> msg #2         <- Still working (another tool round)
 5  assistant   tool-calls    -> msg #2         <- More tools...
 ...
13  assistant   stop          -> msg #2         <- Finally done

14  user        -             NONE              <- You type message #3
```

Key observations:
- **Your messages** (`role=user`) have `parentID=NONE` and no `finish`. They're the roots.
- **Assistant messages** all point `parentID` -> the user message they're responding to. This is how messages stay grouped per "turn."
- **`finish=tool-calls`** means the assistant isn't done yet -- it called tools and will continue. Multiple assistant messages with `tool-calls` form a chain of "agentic loops."
- **`finish=stop`** means the assistant's turn is truly over. It's waiting for you.
- **One user message -> many assistant messages.** Each tool-use round creates a new assistant message, all pointing to the same user message parent.

---

## 3. Part = "One Action Within a Turn"

Parts are the atomic units -- each tool call, reasoning block, or file patch gets its own part file, nested under the message that produced it.

**Directory**: `part/{messageID}/{partID}.json`

There are several `type` values:

| Type | What it is | Example |
|------|-----------|---------|
| `step-start` | Agent begins a new inference step | `{ "type": "step-start", "snapshot": "git-sha" }` |
| `text` | Text output from the model | Model's written response |
| `tool` | A tool invocation | bash, read, write, grep, etc. |
| `reasoning` | Extended thinking block | `{ "type": "reasoning", "text": "..." }` |
| `patch` | File modifications | `{ "type": "patch", "files": ["file.ts"] }` |
| `step-finish` | Agent step complete | `{ "reason": "stop" \| "tool-calls" }` |

**Real tool part** (`part/msg_c3d3dda4.../{partID}.json`):
```json
{
  "id": "prt_c3d3e3fb7001wDMyAq3sowMHm6",
  "sessionID": "ses_3c2c2878bffeZXehJm3rjcNZRl",
  "messageID": "msg_c3d3e29b0001yfNJcYG5BLPWaA",
  "type": "tool",
  "callID": "toolu_01LaYwE7zgdmYRjp7SsTa5CX",
  "tool": "bash",
  "state": {
    "status": "completed",
    "input": { "command": "ls -la", "description": "List files" },
    "output": "total 48\ndrwxr-xr-x...",
    "time": { "start": 1770554018985, "end": 1770554019443 }
  }
}
```

A single assistant message typically contains these parts in order:

```
step-start   -> Agent begins thinking
text         -> Agent writes some text
tool         -> Agent calls a tool (state: pending -> completed)
tool         -> Agent calls another tool
step-finish  -> Agent finishes this step (reason: "tool-calls" -> will continue)
```

---

## 4. How a Session Persists Across Your Messages

The session ID is the constant. Here's the full lifecycle:

```
YOU open OpenCode in /Users/tomas/Workspace/ocwatch
    -> session/386043c.../ses_ABC.json created (time.created = now)

YOU type: "explain how storage works"
    -> message/ses_ABC/msg_001.json (role=user, parentID=null)
    -> session time.updated bumped

AGENT responds (calls tools, reasons, writes)
    -> message/ses_ABC/msg_002.json (role=assistant, parentID=msg_001, finish=tool-calls)
    -> part/msg_002/prt_A.json (step-start)
    -> part/msg_002/prt_B.json (tool: bash)
    -> part/msg_002/prt_C.json (step-finish, reason=tool-calls)
    -> message/ses_ABC/msg_003.json (role=assistant, parentID=msg_001, finish=stop)
    -> part/msg_003/prt_D.json (step-start)
    -> part/msg_003/prt_E.json (text)
    -> part/msg_003/prt_F.json (step-finish, reason=stop)
    -> session time.updated bumped

YOU type: "now add a test"               <- SAME SESSION, new user message
    -> message/ses_ABC/msg_004.json (role=user, parentID=null)
    -> session time.updated bumped

AGENT responds again...
    -> message/ses_ABC/msg_005.json (role=assistant, parentID=msg_004, ...)
    -> more parts...
```

**The session stays the same.** Your messages accumulate in `message/ses_ABC/`. The `time.updated` on the session file gets bumped with each activity.

---

## 5. Parent/Child Sessions (Subagents)

When an agent delegates work (e.g., `task(subagent_type="explore")`), OpenCode creates a **child session**:

```
Root session:   ses_PARENT  (parentID = null)        <- YOUR conversation
Child session:  ses_CHILD   (parentID = ses_PARENT)  <- subagent's work
```

Real examples:
```
ses_3e5850d7c...  parent=ses_3e5854914...  "Research message storage (@explore subagent)"
ses_3d04344a8...  parent=ses_3d0551ea1...  "Add ARIA labels (@sisyphus-junior subagent)"
ses_3cb17054f...  parent=ses_3cb314e46...  "Retry OpenCode schema research (@librarian subagent)"
```

Each child session has its own messages and parts -- it's a fully independent conversation between the parent agent and the subagent. The `parentID` link is how ocwatch builds the agent tree visualization.

---

## 6. ID Formats

All IDs follow a prefixed format:

| Entity | Format | Example |
|--------|--------|---------|
| Session | `ses_{random}` | `ses_3ec7ddb0dffeEx5i93QCLgA74n` |
| Message | `msg_{random}` | `msg_c3d2e62540013PG2xMvPM7k34E` |
| Part | `prt_{random}` | `prt_c3d3e3fb7001wDMyAq3sowMHm6` |
| Project | SHA256 hash | `386043c27ba886538edc95090a732275ede2d4db` |

---

## 7. Relationship Diagram

```
Session (session/{projectID}/{sessionID}.json)
    |
    +-- parentID ----------> [Optional parent session]
    |
    +-- (implicit link via directory)
            |
            v
       Messages (message/{sessionID}/{messageID}.json)
            |
            +-- sessionID ----> [Foreign key back to session]
            +-- parentID -----> [Optional parent message (user msg this responds to)]
            |
            +-- (implicit link via directory)
                    |
                    v
               Parts (part/{messageID}/{partID}.json)
                    |
                    +-- sessionID ----> [Back to session]
                    +-- messageID ----> [Back to message]
```

---

## 8. Full Example Tree

```
Project (386043c...)
 +-- Session ses_ABC                          <- your conversation
      +-- msg_001 (user: "explain storage")
      |    +-- (no parts - user messages don't have tool calls)
      +-- msg_002 (assistant, finish=tool-calls, parent->msg_001)
      |    +-- prt_A (step-start)
      |    +-- prt_B (tool: bash, status: completed)
      |    +-- prt_C (step-finish, reason=tool-calls)
      +-- msg_003 (assistant, finish=stop, parent->msg_001)
      |    +-- prt_D (step-start)
      |    +-- prt_E (text)
      |    +-- prt_F (step-finish, reason=stop)
      +-- msg_004 (user: "now add a test")    <- same session!
      +-- msg_005 (assistant, finish=tool-calls, parent->msg_004)
      |    +-- prt_G (tool: task -> spawns child session)
      |
      +-- Child Session ses_CHILD (parentID=ses_ABC)
           +-- msg_010 (user, agent=explore)
           +-- msg_011 (assistant, agent=explore)
           |    +-- prt_H (tool: grep)
           |    +-- prt_I (tool: read)
           +-- msg_012 (assistant, finish=stop)
```

---

## 9. Additional Storage Directories

The full storage directory also contains:

```
~/.local/share/opencode/storage/
├── session/              # Session metadata (primary)
├── message/              # Message records
├── part/                 # Tool calls / actions
├── project/              # Project metadata
├── todo/                 # Todo items
├── session_diff/         # Session diffs
├── session_share/        # Shared sessions
├── agent-usage-reminder/ # Agent tracking
├── directory-agents/     # Directory-level agent config
├── directory-readme/     # Directory README cache
├── rules-injector/       # Rules injection config
└── migration/            # Migration state
```

ocwatch only reads from `session/`, `message/`, and `part/`.

---

## 10. Plan Files (Boulder)

Separate from the main storage, plan state lives in the project directory:

```
{project-root}/.sisyphus/
├── boulder.json          # Plan state (active plan path, session IDs, status)
└── {plan-name}.md        # Plan markdown with [x]/[ ] checkboxes
```

**boulder.json**:
```json
{
  "active_plan": "plans/main.md",
  "session_ids": ["ses_abc", "ses_def"],
  "status": "active",
  "started_at": 1769858876673,
  "plan_name": "Main Task"
}
```

Plan progress is computed by counting `[x]` vs `[ ]` checkboxes in the markdown file.
