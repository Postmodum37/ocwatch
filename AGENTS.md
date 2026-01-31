# PROJECT KNOWLEDGE BASE

**Generated:** 2025-01-31
**Commit:** cb24f89
**Branch:** main

## OVERVIEW

Real-time TUI dashboard monitoring OpenCode agent activity. Tails logs from `~/.local/share/opencode/log/`, displays sessions, agents, tool calls, and plan progress. Built with Go + Bubble Tea.

## STRUCTURE

```
ocwatch/
├── cmd/ocwatch/main.go     # Entry point: flags, watcher, UI init, signal handling
├── internal/
│   ├── parser/             # Log line parsing (LogEntry struct)
│   ├── plan/               # .sisyphus/boulder.json progress tracking
│   ├── session/            # Session + Project loading from OpenCode storage
│   ├── state/              # Thread-safe app state (RingBuffer, AgentInfo, ToolCall)
│   ├── ui/                 # Bubble Tea Model, panels, sidebar, styles
│   └── watcher/            # fsnotify + tail for log file monitoring
├── go.mod                  # github.com/tomas/ocwatch, Go 1.25.6
└── ocwatch                 # Compiled binary (arm64)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new log field | `internal/parser/parser.go` | Update `LogEntry` struct + `ParseLine()` |
| New UI panel | `internal/ui/panels.go` | Add `renderXxx()` function, call from `ui.go` View() |
| Track new state | `internal/state/state.go` | Add field to `State`, create Get/Set methods with mutex |
| Session filtering | `internal/session/session.go` | `FilterSessionsByToday()`, `FilterActiveSessions()` |
| Plan progress | `internal/plan/plan.go` | `CalculateProgress()` counts markdown checkboxes |
| Key bindings | `internal/ui/ui.go` | `Update()` method, `tea.KeyMsg` switch |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `main()` | func | cmd/ocwatch/main.go | Entry: flags → watcher → state → UI loop |
| `Model` | struct | internal/ui/ui.go | Bubble Tea model (state, styles, panels, scroll) |
| `State` | struct | internal/state/state.go | Thread-safe app state with RWMutex |
| `LogEntry` | struct | internal/parser/parser.go | Parsed log: Timestamp, Service, Agent, Mode, etc |
| `Watcher` | struct | internal/watcher/watcher.go | fsnotify + tail, emits LogEntry via channel |
| `Session` | struct | internal/session/session.go | OpenCode session metadata |
| `RingBuffer` | struct | internal/state/state.go | Fixed-size circular buffer (1000 entries max) |

## CONVENTIONS

- **Thread safety**: All `State` methods use `sync.RWMutex`
- **Channels**: Watcher → entryChan → main goroutine → State.UpdateFromLogEntry()
- **XDG**: Respects `XDG_DATA_HOME`, defaults to `~/.local/share/opencode`
- **Tests**: Table-driven with `t.Run()`, colocated `*_test.go` files
- **No external linter**: Uses standard `gofmt`

## ANTI-PATTERNS (THIS PROJECT)

**CRITICAL GUARDRAILS** (from .sisyphus/plans/ocwatch.md):

| Forbidden | Reason |
|-----------|--------|
| Token/cost estimation | Out of scope |
| Filtering/search UI | Complexity creep |
| Historical analytics | Not a metrics tool |
| Export (CSV/JSON) | Read-only monitor |
| Remote monitoring | Local only |
| Theming/customization | Single style |
| Config persistence | Stateless |
| Modify OpenCode files | READ-ONLY |
| Control agents | Monitor only |
| Poll < 100ms | CPU safety |
| > 1000 log entries | Memory cap (RingBuffer enforces) |
| Windows/Linux support | macOS only for v1 |
| Terminal < 80x24 | Min size |

## COMMANDS

```bash
# Build
go build -o ocwatch ./cmd/ocwatch

# Run
./ocwatch [--project /path] [--data-dir /path]

# Test
go test ./...

# Test verbose
go test -v ./...
```

## NOTES

- **Log format**: `LEVEL TIMESTAMP +Xms key=value key=value ...`
- **Session storage**: `~/.local/share/opencode/storage/session/{projectID}/{sessionID}.json`
- **Plan tracking**: Reads `.sisyphus/boulder.json` from `--project` or cwd
- **Ticker refresh**: UI ticks every 1 second, watcher polls every 100ms fallback
- **Sidebar**: Press 1-9 to filter by session, 0 for all
