package ui

import (
	"fmt"
	"os"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/tomas/ocwatch/internal/plan"
	"github.com/tomas/ocwatch/internal/session"
	"github.com/tomas/ocwatch/internal/state"
)

type tickMsg time.Time

const sidebarWidth = 28

type Model struct {
	state  *state.State
	styles Styles
	width  int
	height int

	activePanel  int // 0: Sessions, 1: Agents, 2: Tools
	scrollOffset int

	boulder      *plan.Boulder
	planProgress *plan.PlanProgress

	allSessions        []session.Session
	selectedSessionIdx int // 0: All, 1-9: Specific session

	quitting bool
}

func NewModel(s *state.State) Model {
	return Model{
		state:       s,
		styles:      DefaultStyles(),
		activePanel: 0,
	}
}

func (m *Model) SetAllSessions(sessions []session.Session) {
	m.allSessions = sessions
}

func calculateMaxScroll(s *state.State, viewportHeight int) int {
	entries := s.GetRecentLogs()
	contentLength := len(entries)
	const statusBarHeight = 1
	const headerHeight = 2
	const statsHeight = 3
	const planHeight = 4
	const panelHeight = 5

	fixedHeight := statusBarHeight + headerHeight + statsHeight + planHeight
	availableHeight := viewportHeight - fixedHeight
	if availableHeight < 10 {
		availableHeight = 10
	}

	maxScroll := contentLength - (availableHeight / 3)
	if maxScroll < 0 {
		maxScroll = 0
	}
	return maxScroll
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
		case "up":
			if m.scrollOffset > 0 {
				m.scrollOffset--
			}
		case "down":
			maxScroll := calculateMaxScroll(m.state, m.height)
			if m.scrollOffset < maxScroll {
				m.scrollOffset++
			}
		case "tab":
			m.activePanel = (m.activePanel + 1) % 3
			m.scrollOffset = 0
		case "0":
			m.selectedSessionIdx = 0
			m.state.SetSelectedSession("")
		case "1", "2", "3", "4", "5", "6", "7", "8", "9":
			// Session selection uses 1-indexed keys (1-9) for UX,
			// but arrays are 0-indexed, so we subtract 1 for array access.
			// key "1" selects index 0, "2" selects index 1, etc.
			keyNum := int(msg.String()[0] - '0')
			if keyNum > 0 && keyNum <= len(m.allSessions) {
				m.selectedSessionIdx = keyNum
				m.state.SetSelectedSession(m.allSessions[keyNum-1].ID)
			}
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

	if m.width < 80 || m.height < 24 {
		return fmt.Sprintf("Terminal too small: %dx%d (min 80x24)", m.width, m.height)
	}

	// Layout constants
	showSidebar := m.width >= 60

	// Status bar is always full width at the bottom
	statusBar := renderStatusBar(m.styles, m.width)
	statusBarHeight := lipgloss.Height(statusBar)

	// Calculate content area (above status bar)
	contentHeight := m.height - statusBarHeight
	if contentHeight < 0 {
		contentHeight = 0
	}

	// Determine widths
	mainPanelWidth := m.width
	if showSidebar {
		mainPanelWidth = m.width - sidebarWidth
	}

	// Render sidebar if shown
	var sidebar string
	if showSidebar {
		// Pass selectedSessionIdx - 1 because 0 means "none" (so -1 won't match any index)
		sidebar = renderSidebar(m.styles, m.allSessions, m.selectedSessionIdx-1)
	}

	// Render main panel components
	header := renderHeader(m.styles, mainPanelWidth, true)
	stats := renderStats(m.styles, m.state, mainPanelWidth)
	planView := renderPlanProgress(m.styles, m.planProgress, m.boulder, mainPanelWidth)

	// Calculate available height for scrollable panels
	fixedHeight := lipgloss.Height(header) + lipgloss.Height(stats) + lipgloss.Height(planView)
	availableScrollHeight := contentHeight - fixedHeight

	if availableScrollHeight < 10 {
		availableScrollHeight = 10 // Ensure a minimum usable area
	}

	// Dynamic split of available height among panels
	panelHeight := availableScrollHeight / 3
	if panelHeight < 1 {
		panelHeight = 1
	}

	// Render Sessions panel with optional scrolling
	sessionsActive := m.activePanel == 0
	sessionsScroll := 0
	if sessionsActive {
		sessionsScroll = m.scrollOffset
	}
	sessionsView := renderSessions(m.styles, m.state, mainPanelWidth, panelHeight, sessionsScroll, sessionsActive)

	// Determine selected session ID
	var selectedSessionID string
	if m.selectedSessionIdx > 0 && m.selectedSessionIdx <= len(m.allSessions) {
		selectedSessionID = m.allSessions[m.selectedSessionIdx-1].ID
	}

	// Render Agent Tree panel
	agentsActive := m.activePanel == 1
	agentView := renderAgentTree(m.styles, m.state, selectedSessionID, mainPanelWidth, panelHeight, agentsActive)

	// Render Tool Activity panel
	toolView := renderToolActivity(m.styles, m.state, selectedSessionID, mainPanelWidth, panelHeight)

	// Assemble Right Stack
	rightStack := lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		sessionsView,
		agentView,
		toolView,
		stats,
		planView,
	)

	// Assemble Content Body
	var contentBody string
	if showSidebar {
		contentBody = lipgloss.JoinHorizontal(lipgloss.Top, sidebar, rightStack)
	} else {
		contentBody = rightStack
	}

	// Final Assembly
	return lipgloss.JoinVertical(
		lipgloss.Left,
		contentBody,
		statusBar,
	)
}
