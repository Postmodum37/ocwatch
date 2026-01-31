package ui

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/tomas/ocwatch/internal/plan"
	"github.com/tomas/ocwatch/internal/state"
)

func renderHeader(styles Styles, width int, connected bool) string {
	status := "OFFLINE"
	statusColor := styles.SubtleColor
	if connected {
		status = "ONLINE"
		statusColor = styles.Highlight
	}

	title := styles.Title.Render("OCWatch")
	subtitle := styles.SubtleText.Render("OpenCode Activity Monitor")
	timeStr := time.Now().Format("15:04:05")

	statusBlock := lipgloss.NewStyle().Foreground(statusColor).Render(status)

	left := lipgloss.JoinHorizontal(lipgloss.Center, title, " - ", subtitle)
	right := lipgloss.JoinHorizontal(lipgloss.Center, statusBlock, "  ", timeStr)

	// Calculate spacing
	w := width - lipgloss.Width(left) - lipgloss.Width(right) - 2
	if w < 0 {
		w = 0
	}
	spacer := strings.Repeat(" ", w)

	content := lipgloss.JoinHorizontal(lipgloss.Center, left, spacer, right)
	return styles.Header.Width(width - 2).Render(content)
}

func renderSessions(styles Styles, s *state.State, width, height, scrollOffset int, active bool) string {
	sessions := s.GetAllSessions()

	// Convert to list for sorting
	type sessItem struct {
		ID      string
		Project string
		Title   string
		Updated time.Time
	}

	var items []sessItem
	for _, sess := range sessions {
		items = append(items, sessItem{
			ID:      sess.ID,
			Project: sess.ProjectID,
			Title:   sess.Title,
			Updated: sess.Updated,
		})
	}

	// Sort by updated desc
	sort.Slice(items, func(i, j int) bool {
		return items[i].Updated.After(items[j].Updated)
	})

	var rows []string
	for _, item := range items {
		line := fmt.Sprintf("%-12s %-15s %q", item.ID, item.Project, item.Title)
		// Truncate if too long
		if len(line) > width-4 {
			line = line[:width-7] + "..."
		}
		rows = append(rows, line)
	}

	// Scrolling logic
	start := scrollOffset
	end := start + height
	if start >= len(rows) {
		start = len(rows) - 1
		if start < 0 {
			start = 0
		}
	}
	if end > len(rows) {
		end = len(rows)
	}

	visibleRows := rows
	if len(rows) > 0 {
		visibleRows = rows[start:end]
	} else {
		visibleRows = []string{"No active sessions"}
	}

	content := strings.Join(visibleRows, "\n")

	style := styles.Panel
	if active {
		style = style.BorderForeground(styles.Highlight)
	}

	return style.Width(width - 2).Height(height).Render(
		lipgloss.JoinVertical(lipgloss.Left,
			styles.BoldText.Render("ACTIVE SESSIONS"),
			content,
		),
	)
}

func renderAgentTree(styles Styles, s *state.State, sessionID string, width, height int, active bool) string {
	// Use GetFilteredAgentTree - empty sessionID shows all agents
	agents := s.GetFilteredAgentTree(sessionID)

	var rows []string
	if sessionID != "" {
		rows = append(rows, sessionID)
	} else {
		rows = append(rows, "All Sessions")
	}

	// Basic tree rendering
	for i, agent := range agents {
		prefix := "├── "
		if i == len(agents)-1 {
			prefix = "└── "
		}
		rows = append(rows, fmt.Sprintf("%s%s (mode=%s)", prefix, agent.Name, agent.Mode))
	}

	content := strings.Join(rows, "\n")

	style := styles.Panel
	if active {
		style = style.BorderForeground(styles.Highlight)
	}

	return style.Width(width - 2).Height(height).Render(
		lipgloss.JoinVertical(lipgloss.Left,
			styles.BoldText.Render("AGENT TREE"),
			content,
		),
	)
}

func renderToolActivity(styles Styles, s *state.State, sessionID string, width, height int) string {
	calls := s.GetFilteredToolCalls(sessionID)

	// Show last N calls that fit height
	maxCalls := height
	if len(calls) > maxCalls {
		calls = calls[len(calls)-maxCalls:]
	}

	var rows []string
	for _, call := range calls {
		rows = append(rows, fmt.Sprintf("%s: %s", call.Timestamp.Format("15:04:05"), call.Name))
	}

	content := strings.Join(rows, "\n")

	return styles.Panel.Width(width - 2).Height(height).Render(
		lipgloss.JoinVertical(lipgloss.Left,
			styles.BoldText.Render("TOOL ACTIVITY"),
			content,
		),
	)
}

func renderStats(styles Styles, s *state.State, width int) string {
	counts := s.GetCallCounts()

	var parts []string
	for model, count := range counts {
		parts = append(parts, fmt.Sprintf("%s: %d", model, count))
	}
	sort.Strings(parts)

	content := strings.Join(parts, " │ ")
	if len(content) > width-4 {
		content = content[:width-7] + "..."
	}

	return styles.Panel.Width(width - 2).Render(
		lipgloss.JoinVertical(lipgloss.Left,
			styles.BoldText.Render("STATS"),
			content,
		),
	)
}

func renderPlanProgress(styles Styles, p *plan.PlanProgress, b *plan.Boulder, width int) string {
	if p == nil {
		return styles.Panel.Width(width - 2).Render("No plan loaded")
	}

	barWidth := width - 20
	if barWidth < 10 {
		barWidth = 10
	}

	filled := int(p.Progress * float64(barWidth))
	bar := "[" + strings.Repeat("█", filled) + strings.Repeat("░", barWidth-filled) + "]"

	info := fmt.Sprintf("%d/%d tasks", p.Completed, p.Total)

	title := "PLAN"
	if b != nil {
		title = fmt.Sprintf("PLAN: %s", b.ActivePlan)
	}

	return styles.Panel.Width(width - 2).Render(
		lipgloss.JoinVertical(lipgloss.Left,
			styles.BoldText.Render(title),
			lipgloss.JoinHorizontal(lipgloss.Center, bar, " ", info),
		),
	)
}

func renderStatusBar(styles Styles, width int) string {
	help := "q:quit │ ↑↓:scroll │ Tab:switch │ 0-9:session"
	return styles.StatusBar.Width(width - 2).Render(help)
}
