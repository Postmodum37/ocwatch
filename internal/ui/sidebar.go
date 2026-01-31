package ui

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/tomas/ocwatch/internal/session"
)

func renderSidebar(styles Styles, sessions []session.Session, selectedIdx int, height int) string {
	var rows []string

	for i, sess := range sessions {
		projectName := filepath.Base(sess.ProjectWorktree)
		if sess.ProjectWorktree == "" {
			projectName = "unknown"
		} else if projectName == "." || projectName == "/" {
		}

		var prefix string
		if i < 9 {
			prefix = fmt.Sprintf("%d. ", i+1)
		} else {
			prefix = "   "
		}

		line1Text := prefix + projectName
		if len(line1Text) > 24 {
			line1Text = line1Text[:23] + "…"
		}

		slug := sess.Slug
		if slug == "" {
			slug = sess.Title
		}

		line2Text := "   " + slug
		if len(line2Text) > 24 {
			line2Text = line2Text[:23] + "…"
		}

		line1 := styles.NormalText.Render(fmt.Sprintf("%-24s", line1Text))
		line2 := styles.SubtleText.Render(fmt.Sprintf("%-24s", line2Text))

		if i == selectedIdx {
			highlightStyle := lipgloss.NewStyle().Foreground(styles.Highlight)
			line1 = highlightStyle.Render(fmt.Sprintf("%-24s", line1Text))
			line2 = highlightStyle.Render(fmt.Sprintf("%-24s", line2Text))
		}

		rows = append(rows, line1)
		rows = append(rows, line2)
	}

	content := strings.Join(rows, "\n")

	return styles.Panel.
		Width(sidebarWidth - 2).
		Height(height).
		Render(content)
}
