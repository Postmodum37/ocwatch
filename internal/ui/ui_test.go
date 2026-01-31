package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/tomas/ocwatch/internal/session"
	"github.com/tomas/ocwatch/internal/state"
)

func TestNewModel(t *testing.T) {
	s := state.NewState()
	m := NewModel(s)

	if m.state != s {
		t.Error("NewModel did not set state")
	}
	if m.activePanel != 0 {
		t.Error("NewModel did not set activePanel to 0")
	}
}

func TestUpdate(t *testing.T) {
	s := state.NewState()
	m := NewModel(s)

	// Test Quit
	msg := tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")}
	newM, cmd := m.Update(msg)

	newModel := newM.(Model)
	if !newModel.quitting {
		t.Error("q key did not set quitting to true")
	}
	if cmd == nil {
		t.Error("q key did not return a command")
	}

	m = NewModel(s)
	m.height = 24
	m.width = 80

	msg = tea.KeyMsg{Type: tea.KeyDown}
	newM, _ = m.Update(msg)
	newModel = newM.(Model)
	if newModel.scrollOffset < 0 {
		t.Errorf("down key resulted in negative scrollOffset, got %d", newModel.scrollOffset)
	}

	msg = tea.KeyMsg{Type: tea.KeyUp}
	newM, _ = newModel.Update(msg)
	newModel = newM.(Model)
	if newModel.scrollOffset < 0 {
		t.Errorf("up key resulted in negative scrollOffset, got %d", newModel.scrollOffset)
	}

	// Test Tab Switch
	m = NewModel(s)
	msg = tea.KeyMsg{Type: tea.KeyTab}
	newM, _ = m.Update(msg)
	newModel = newM.(Model)
	if newModel.activePanel != 1 {
		t.Errorf("tab key did not switch activePanel to 1, got %d", newModel.activePanel)
	}

	// Test Tab Switch Cycle
	m.activePanel = 2
	newM, _ = m.Update(msg)
	newModel = newM.(Model)
	if newModel.activePanel != 0 {
		t.Errorf("tab key did not cycle activePanel to 0, got %d", newModel.activePanel)
	}
}

func TestKeyHandler_ZeroClearsSelection(t *testing.T) {
	s := state.NewState()
	m := NewModel(s)
	m.allSessions = []session.Session{
		{ID: "sess1", Title: "Session 1"},
		{ID: "sess2", Title: "Session 2"},
	}
	m.selectedSessionIdx = 1

	msg := tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("0")}
	newM, _ := m.Update(msg)
	newModel := newM.(Model)

	if newModel.selectedSessionIdx != 0 {
		t.Errorf("key 0 did not clear selection, got selectedSessionIdx=%d", newModel.selectedSessionIdx)
	}

	if s.GetSelectedSession() != "" {
		t.Errorf("key 0 did not clear state's selected session, got %q", s.GetSelectedSession())
	}
}

func TestKeyHandler_NumberSelectsSession(t *testing.T) {
	s := state.NewState()
	m := NewModel(s)
	m.allSessions = []session.Session{
		{ID: "sess1", Title: "Session 1"},
		{ID: "sess2", Title: "Session 2"},
		{ID: "sess3", Title: "Session 3"},
	}

	msg := tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("1")}
	newM, _ := m.Update(msg)
	newModel := newM.(Model)

	if newModel.selectedSessionIdx != 1 {
		t.Errorf("key 1 did not set selectedSessionIdx to 1, got %d", newModel.selectedSessionIdx)
	}
	if s.GetSelectedSession() != "sess1" {
		t.Errorf("key 1 did not set state's selected session to sess1, got %q", s.GetSelectedSession())
	}

	msg = tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("3")}
	newM, _ = newModel.Update(msg)
	newModel = newM.(Model)

	if newModel.selectedSessionIdx != 3 {
		t.Errorf("key 3 did not set selectedSessionIdx to 3, got %d", newModel.selectedSessionIdx)
	}
	if s.GetSelectedSession() != "sess3" {
		t.Errorf("key 3 did not set state's selected session to sess3, got %q", s.GetSelectedSession())
	}

	msg = tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("9")}
	newM, _ = newModel.Update(msg)
	newModel = newM.(Model)

	if newModel.selectedSessionIdx != 3 {
		t.Errorf("key 9 with only 3 sessions should be ignored, got selectedSessionIdx=%d", newModel.selectedSessionIdx)
	}
	if s.GetSelectedSession() != "sess3" {
		t.Errorf("key 9 with only 3 sessions should not change state, got %q", s.GetSelectedSession())
	}
}

func TestView(t *testing.T) {
	s := state.NewState()
	m := NewModel(s)
	m.width = 80
	m.height = 24

	output := m.View()
	if output == "" {
		t.Error("View returned empty string")
	}

	if len(output) < 100 {
		t.Error("View output seems too short for a full dashboard")
	}
}

func TestScrollBoundsEnforced(t *testing.T) {
	s := state.NewState()
	m := NewModel(s)
	m.width = 80
	m.height = 24

	for i := 0; i < 100; i++ {
		msg := tea.KeyMsg{Type: tea.KeyDown}
		newM, _ := m.Update(msg)
		m = newM.(Model)
	}

	if m.scrollOffset < 0 {
		t.Errorf("scrollOffset should not be negative, got %d", m.scrollOffset)
	}

	maxScroll := 0
	if m.scrollOffset > maxScroll {
		t.Errorf("scrollOffset should not exceed maxScroll of %d, got %d", maxScroll, m.scrollOffset)
	}
}

func TestPanelHeightSmallTerminal(t *testing.T) {
	s := state.NewState()
	m := NewModel(s)
	m.width = 80
	m.height = 15

	output := m.View()
	if output == "" {
		t.Error("View returned empty string on small terminal")
	}

	lines := len(output)
	if lines > m.height*m.width {
		t.Logf("View output size: %d chars (terminal: %dx%d)", lines, m.width, m.height)
	}
}
