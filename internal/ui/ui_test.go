package ui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
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

	// Test Scroll Down
	m = NewModel(s)
	msg = tea.KeyMsg{Type: tea.KeyDown}
	newM, _ = m.Update(msg)
	newModel = newM.(Model)
	if newModel.scrollOffset != 1 {
		t.Errorf("down key did not increment scrollOffset, got %d", newModel.scrollOffset)
	}

	// Test Scroll Up
	msg = tea.KeyMsg{Type: tea.KeyUp}
	newM, _ = newModel.Update(msg)
	newModel = newM.(Model)
	if newModel.scrollOffset != 0 {
		t.Errorf("up key did not decrement scrollOffset, got %d", newModel.scrollOffset)
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
