# OCWatch

Real-time web dashboard for monitoring [OpenCode](https://github.com/opencode-ai/opencode) / Claude Code agent activity.

## Install

```bash
bunx ocwatch
```

Or install globally:

```bash
bun install -g ocwatch
ocwatch
```

Opens a dashboard at `http://localhost:50234` showing live agent sessions, tool calls, and plan progress.

## Options

| Flag | Description |
|------|-------------|
| `--port <number>` | Server port (default: 50234) |
| `--no-browser` | Don't auto-open browser |
| `--project <path>` | Set project directory for plan tracking |
| `--help` | Show help |

## What it monitors

- **Sessions** — active and recent agent sessions
- **Agent hierarchy** — parent/child agent tree
- **Tool calls** — live tool invocations with metadata
- **Plan progress** — task completion from `.sisyphus/boulder.json`
- **Activity stream** — real-time feed of agent actions

## Requirements

- [Bun](https://bun.sh) v1.0+
- macOS
- OpenCode or Claude Code running (reads from `~/.local/share/opencode/storage/`)

## License

MIT
