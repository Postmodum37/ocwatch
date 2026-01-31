package ui

import (
	"os"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/tomas/ocwatch/internal/plan"
	"github.com/tomas/ocwatch/internal/state"
)

type tickMsg time.Time

type Model struct {
	state  *state.State
	styles Styles
	width  int
	height int

	activePanel  int // 0: Sessions, 1: Agents, 2: Tools
	scrollOffset int

	boulder      *plan.Boulder
	planProgress *plan.PlanProgress

	muted    bool
	quitting bool
}

func NewModel(s *state.State) Model {
	return Model{
		state:       s,
		styles:      DefaultStyles(),
		activePanel: 0,
	}
}

func (m Model) Init() tea.Cmd {
	return tea.Tick(time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "ctrl+c":
			m.quitting = true
			return m, tea.Quit
		case "m":
			m.muted = !m.muted
		case "up":
			if m.scrollOffset > 0 {
				m.scrollOffset--
			}
		case "down":
			m.scrollOffset++
		case "tab":
			m.activePanel = (m.activePanel + 1) % 3
			m.scrollOffset = 0 // Reset scroll when switching
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tickMsg:
		// Refresh plan data
		cwd, _ := os.Getwd()
		m.boulder, _ = plan.ReadBoulder(cwd)
		if m.boulder != nil && m.boulder.ActivePlan != "" {
			m.planProgress, _ = plan.ReadPlan(m.boulder.ActivePlan)
		}

		return m, tea.Tick(time.Second, func(t time.Time) tea.Msg {
			return tickMsg(t)
		})
	}

	return m, nil
}

func (m Model) View() string {
	if m.quitting {
		return ""
	}

	if m.width == 0 {
		return "Loading..."
	}

	// Calculate fixed heights
	// Header: 3 (border + content)
	// Stats: 3 (border + content)
	// Plan: 3 (border + content)
	// Status: 3 (border + content)
	// Total fixed: 12 lines

	// We can combine Stats and Plan into one row if width allows, or stack them.
	// Let's assume we stack them for now to ensure we meet the "Create ... panels" requirement clearly.
	// But to save space, maybe we reduce borders?

	// Calculate fixed heights for non-scrollable areas
	header := renderHeader(m.styles, m.width, true)
	stats := renderStats(m.styles, m.state, m.width)
	planView := renderPlanProgress(m.styles, m.planProgress, m.boulder, m.width)
	statusBar := renderStatusBar(m.styles, m.width)

	// Available height for the three main scrollable panels
	fixedHeight := lipgloss.Height(header) + lipgloss.Height(stats) + lipgloss.Height(planView) + lipgloss.Height(statusBar)
	availableHeight := m.height - fixedHeight

	if availableHeight < 10 {
		availableHeight = 10 // Ensure a minimum usable area
	}

	// Dynamic split of available height among panels
	panelHeight := availableHeight / 3
	if panelHeight < 3 {
		panelHeight = 3
	}

	// Render Sessions panel with optional scrolling
	sessionsActive := m.activePanel == 0
	sessionsScroll := 0
	if sessionsActive {
		sessionsScroll = m.scrollOffset
	}
	sessionsView := renderSessions(m.styles, m.state, m.width, panelHeight, sessionsScroll, sessionsActive)

	// Render Agent Tree panel
	sessMap := m.state.GetAllSessions()
	var sessionID string
	for id := range sessMap {
		sessionID = id
		break
	}
	agentsActive := m.activePanel == 1
	agentView := renderAgentTree(m.styles, m.state, sessionID, m.width, panelHeight, agentsActive)

	// Render Tool Activity panel
	toolView := renderToolActivity(m.styles, m.state, m.width, panelHeight)

	return lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		sessionsView,
		agentView,
		toolView,
		stats,
		planView,
		statusBar,
	)
}
