# Contributing to OCWatch

Thanks for your interest in contributing. This guide covers the process and conventions.

## Getting Started

See the [Development](README.md#development) section in the README for setup, running, and testing instructions.

## Before You Contribute

- Check [existing issues](https://github.com/tomascoox/ocwatch/issues) and PRs to avoid duplicating work.
- For non-trivial changes, open an issue first to discuss the approach.
- Bug fixes and small improvements can go straight to a PR.

## Development Workflow

1. Fork the repo and clone your fork.
2. Create a feature branch from `main`.
3. Make your changes.
4. Run all checks:
   ```bash
   bun run tsc -b                        # Type check
   cd src/client && bun run lint          # Lint
   bun run test                           # Server/shared tests
   cd src/client && bun run test          # Client tests (Vitest)
   ```
5. Commit with a conventional commit message (see below).
6. Open a PR against `main`.

## Code Conventions

- **TypeScript strict mode** — no `any` unless absolutely necessary.
- **Path aliases** — use `@server/`, `@client/`, `@shared/` imports, not relative paths across boundaries.
- **State management** — React Context API only. No Redux, Zustand, or other state libraries.
- **Styling** — Tailwind CSS, single dark theme (`#0d1117` background, `#58a6ff` accent). No light theme, no theming system.
- **Test file naming**:
  - Server/shared: `*.test.ts`
  - Client unit tests: `*.vitest.ts` / `*.vitest.tsx`
  - E2E tests: `*.pw.ts`
- **Commit messages** — use [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `ci:`, `chore:`.

## PR Guidelines

- One concern per PR — don't mix a bug fix with a refactor.
- CI must pass (type check, lint, tests, build).
- Add tests for new functionality.
- If your change affects the API contract, update types in `src/shared/types/`.
- Keep PRs focused and reviewable — large PRs take longer to review and are more likely to need rework.

## Reporting Issues

When filing a bug report, include:

- **Expected vs actual behavior**
- **Steps to reproduce**
- **ocwatch version** (`bunx ocwatch --help` or check `package.json`)
- **macOS version**
- **Screenshots** for UI issues

## Out of Scope

The following are intentionally excluded from this project. PRs for these will be closed:

- Token/cost estimation
- Filtering or search UI
- Historical analytics or metrics
- Data export (CSV, JSON)
- Remote monitoring
- Theming or visual customization
- Config persistence (beyond URL params)
- Modifying or controlling OpenCode files/agents
- Windows or Linux support
- WebSocket (use HTTP polling + SSE)
- Server-side rendering

See [AGENTS.md](AGENTS.md) for the full rationale behind these constraints.
