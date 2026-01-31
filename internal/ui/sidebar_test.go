package ui

import (
	"fmt"
	"strings"
	"testing"

	"github.com/charmbracelet/lipgloss"
	"github.com/tomas/ocwatch/internal/session"
)

func TestRenderSidebar_ShowsProjectName(t *testing.T) {
	styles := DefaultStyles()
	sessions := []session.Session{
		{
			ID:              "sess_1",
			ProjectWorktree: "/path/to/my-project",
			Slug:            "coding-session",
		},
	}

	output := renderSidebar(styles, sessions, -1)

	if !strings.Contains(output, "my-project") {
		t.Errorf("Expected output to contain project name 'my-project', got:\n%s", output)
	}
}

func TestRenderSidebar_ShowsSessionNumbers(t *testing.T) {
	styles := DefaultStyles()
	sessions := []session.Session{
		{ProjectWorktree: "/a", Slug: "s1"},
		{ProjectWorktree: "/b", Slug: "s2"},
	}

	output := renderSidebar(styles, sessions, -1)

	if !strings.Contains(output, "1. a") {
		t.Errorf("Expected '1. a', got:\n%s", output)
	}
	if !strings.Contains(output, "2. b") {
		t.Errorf("Expected '2. b', got:\n%s", output)
	}
}

func TestRenderSidebar_HighlightsSelected(t *testing.T) {
	styles := DefaultStyles()
	sessions := []session.Session{
		{ProjectWorktree: "/unselected", Slug: "s1"},
		{ProjectWorktree: "/selected", Slug: "s2"},
	}

	output := renderSidebar(styles, sessions, -1)

	if !strings.Contains(output, "selected") {
		t.Error("Output missing selected project name")
	}
}

func TestRenderSidebar_FixedWidth(t *testing.T) {
	styles := DefaultStyles()
	sessions := []session.Session{
		{ProjectWorktree: "/short", Slug: "s1"},
	}

	output := renderSidebar(styles, sessions, -1)
	lines := strings.Split(output, "\n")

	for i, line := range lines {
		width := lipgloss.Width(line)
		if width != 28 && width != 0 {
			t.Errorf("Line %d width expected 28, got %d. Content: %q", i, width, line)
		}
	}
}

func TestRenderSidebar_HandleMoreThanNine(t *testing.T) {
	styles := DefaultStyles()
	sessions := make([]session.Session, 11)
	for i := 0; i < 11; i++ {
		sessions[i] = session.Session{
			ProjectWorktree: fmt.Sprintf("/p%d", i+1),
			Slug:            fmt.Sprintf("s%d", i+1),
		}
	}

	output := renderSidebar(styles, sessions, -1)

	if !strings.Contains(output, "9. p9") {
		t.Error("Expected '9. p9'")
	}
	if strings.Contains(output, "10. p10") {
		t.Error("Did not expect '10. p10' (only 1-9 numbered)")
	}
	if !strings.Contains(output, "p10") {
		t.Error("Expected 'p10' to be visible")
	}
}

func TestSidebarTruncationEllipsisVisible(t *testing.T) {
	styles := DefaultStyles()
	longProjectName := "this-is-a-very-long-project-name"
	sessions := []session.Session{
		{
			ID:              "sess_1",
			ProjectWorktree: "/" + longProjectName,
			Slug:            "test-slug",
		},
	}

	output := renderSidebar(styles, sessions, -1)

	if !strings.Contains(output, "…") {
		t.Errorf("Expected ellipsis '…' in truncated output, got:\n%s", output)
	}
}
