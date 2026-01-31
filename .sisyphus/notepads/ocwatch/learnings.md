
## TUI Implementation
- Used `bubbletea` for the event loop and `lipgloss` for styling.
- Separated styling into `styles.go` using a struct to avoid re-allocating styles on every render.
- Separated rendering logic into `panels.go` functions, keeping the `Model` clean.
- Used `tea.Tick` for periodic updates from the shared state.
- Handled dynamic resizing by calculating panel heights in `View()` based on available height.
## Jan 31, 2026

- Created comprehensive README.md for OCWatch.
- Added inline documentation for core concurrency and layout logic.
- Standardized documentation structure according to project requirements.
