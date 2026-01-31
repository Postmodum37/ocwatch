# OpenCode Activity Monitor - Implementation Plan

## Overview

Build a Go TUI dashboard that monitors OpenCode's real-time activity by tailing log files. Shows which models are being called, from which providers, and which agents are active.

## Requirements

- **Real-time monitoring** of model calls and agent activity
- **Display**: Model + Provider per call, Agent activity
- **Stack**: Go with bubbletea/lipgloss (matches OpenCode's stack)

## Data Source

OpenCode logs to `~/.local/share/opencode/log/YYYY-MM-DDTHHMMSS.log`

Key log entries to parse:
```
INFO  2026-01-29T20:45:27 +0ms service=llm providerID=anthropic modelID=claude-opus-4-5 sessionID=ses_xxx agent=sisyphus mode=primary stream
INFO  2026-01-29T20:45:26 +2ms service=session id=ses_xxx slug=hidden-meadow projectID=xxx directory=/path title=New session created
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  OpenCode Activity Monitor                                  │
├─────────────────────────────────────────────────────────────┤
│  Session: ses_3f47f0a9 │ Project: addon-radar               │
├─────────────────────────────────────────────────────────────┤
│  ACTIVE CALLS                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 20:45:27  anthropic/claude-opus-4-5    sisyphus     │   │
│  │ 20:45:26  google/gemini-3-flash        title        │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  STATS                                                      │
│  anthropic: 45 calls │ google: 12 calls │ Total: 57        │
├─────────────────────────────────────────────────────────────┤
│  RECENT ACTIVITY                                            │
│  [scrollable log of recent calls]                           │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

### Phase 1: Core Log Parser

**File**: `internal/parser/parser.go`

```go
type LogEntry struct {
    Timestamp  time.Time
    Service    string
    ProviderID string
    ModelID    string
    SessionID  string
    Agent      string
    Mode       string
}

func ParseLine(line string) (*LogEntry, error)
```

Parse format: `INFO  TIMESTAMP +Xms key=value key=value ...`

### Phase 2: Log Watcher

**File**: `internal/watcher/watcher.go`

- Find latest log file in `~/.local/share/opencode/log/`
- Use fsnotify to watch for new files
- Tail the current log file
- Send parsed entries to a channel

### Phase 3: TUI with Bubbletea

**File**: `internal/ui/ui.go`

Components:
1. **Header**: Current session info
2. **Active Calls**: List of recent model calls (last 10)
3. **Stats**: Call counts per provider
4. **Activity Log**: Scrollable history

Keybindings:
- `q` / `Ctrl+C`: Quit
- `↑/↓`: Scroll activity log
- `c`: Clear stats

### Phase 4: Main Entry Point

**File**: `cmd/ocwatch/main.go`

```go
func main() {
    logDir := filepath.Join(os.Getenv("HOME"), ".local/share/opencode/log")

    watcher := watcher.New(logDir)
    entries := watcher.Start()

    ui := ui.New(entries)
    p := tea.NewProgram(ui, tea.WithAltScreen())
    p.Run()
}
```

## File Structure

```
ocwatch/
├── cmd/
│   └── ocwatch/
│       └── main.go
├── internal/
│   ├── parser/
│   │   └── parser.go
│   ├── watcher/
│   │   └── watcher.go
│   └── ui/
│       ├── ui.go
│       └── styles.go
├── go.mod
└── README.md
```

## Dependencies

```go
require (
    github.com/charmbracelet/bubbletea v1.2.4
    github.com/charmbracelet/lipgloss v1.0.0
    github.com/fsnotify/fsnotify v1.8.0
    github.com/nxadm/tail v1.4.11
)
```

## Verification

1. **Build**: `go build ./cmd/ocwatch`
2. **Run alongside OpenCode**: Start `ocwatch` in one terminal, run OpenCode in another
3. **Verify display**: Should show model calls in real-time as OpenCode makes them
4. **Test with different agents**: Use `@explore`, `@general` in OpenCode to see agent tracking

## Community Alternatives

If you'd rather use existing tools:

- **[ocmonitor](https://github.com/Shlomob/ocmonitor-share)** - Purpose-built OpenCode monitor with real-time dashboard
- **[tokscale](https://github.com/junhoyeo/tokscale)** - Multi-platform token tracking (OpenCode, Claude Code, Cursor, etc.)
- **[tmuxcc](https://github.com/nyanko3141592/tmuxcc)** - TUI dashboard for managing AI coding agents in tmux

## Future Enhancements (out of scope)

- Token/cost tracking (requires additional log parsing)
- Historical session replay
- Export to JSON
- Integration as OpenCode plugin
