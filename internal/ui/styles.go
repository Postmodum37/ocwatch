package ui

import "github.com/charmbracelet/lipgloss"

type Styles struct {
	BorderColor lipgloss.Color
	TextColor   lipgloss.Color
	SubtleColor lipgloss.Color
	AccentColor lipgloss.Color
	Highlight   lipgloss.Color
	ErrorColor  lipgloss.Color

	Base        lipgloss.Style
	Panel       lipgloss.Style
	Title       lipgloss.Style
	Header      lipgloss.Style
	StatusBar   lipgloss.Style
	ActiveTab   lipgloss.Style
	InactiveTab lipgloss.Style

	// Text styles
	NormalText lipgloss.Style
	SubtleText lipgloss.Style
	AccentText lipgloss.Style
	BoldText   lipgloss.Style
}

func DefaultStyles() Styles {
	s := Styles{
		BorderColor: lipgloss.Color("62"),  // Purple
		TextColor:   lipgloss.Color("252"), // Light Gray
		SubtleColor: lipgloss.Color("241"), // Dark Gray
		AccentColor: lipgloss.Color("205"), // Pink
		Highlight:   lipgloss.Color("86"),  // Cyan
		ErrorColor:  lipgloss.Color("196"), // Red
	}

	s.Base = lipgloss.NewStyle().
		Foreground(s.TextColor)

	s.Panel = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(s.BorderColor).
		Padding(0, 1)

	s.Title = lipgloss.NewStyle().
		Foreground(s.AccentColor).
		Bold(true)

	s.Header = lipgloss.NewStyle().
		Border(lipgloss.NormalBorder(), false, false, true, false).
		BorderForeground(s.BorderColor).
		Padding(0, 1).
		Bold(true)

	s.StatusBar = lipgloss.NewStyle().
		Border(lipgloss.NormalBorder(), true, false, false, false).
		BorderForeground(s.BorderColor).
		Padding(0, 1).
		Foreground(s.SubtleColor)

	s.ActiveTab = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(s.Highlight).
		Foreground(s.Highlight).
		Bold(true)

	s.InactiveTab = lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(s.SubtleColor).
		Foreground(s.SubtleColor)

	s.NormalText = lipgloss.NewStyle().Foreground(s.TextColor)
	s.SubtleText = lipgloss.NewStyle().Foreground(s.SubtleColor)
	s.AccentText = lipgloss.NewStyle().Foreground(s.AccentColor)
	s.BoldText = lipgloss.NewStyle().Bold(true)

	return s
}
