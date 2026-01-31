package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/tomas/ocwatch/internal/plan"
	"github.com/tomas/ocwatch/internal/session"
	"github.com/tomas/ocwatch/internal/state"
	"github.com/tomas/ocwatch/internal/ui"
	"github.com/tomas/ocwatch/internal/watcher"
)

func main() {
	dataDir := flag.String("data-dir", "", "Path to OpenCode data directory (default: ~/.local/share/opencode)")
	projectDir := flag.String("project", "", "Project directory for plan tracking (optional)")
	flag.Parse()

	if *dataDir == "" {
		*dataDir = getDataDir()
	}

	if err := os.MkdirAll(*dataDir, 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	appState := state.NewState()

	logDir := filepath.Join(*dataDir, "log")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		log.Fatalf("Failed to create log directory: %v", err)
	}
	w := watcher.NewWatcher(logDir)

	uiModel := ui.NewModel(appState)

	// Load all sessions from all projects (filtered to today)
	allSessions, err := session.ListAllSessions(*dataDir)
	if err == nil {
		todaySessions := session.FilterSessionsByToday(allSessions)
		appState.SetAllSessions(todaySessions)
		uiModel.SetAllSessions(todaySessions)

		// Also add to legacy session tracking for backward compatibility
		for _, sess := range todaySessions {
			s := sess
			appState.AddSession(&s)
		}
	}

	if *projectDir != "" {
		boulder, err := plan.ReadBoulder(*projectDir)
		if err == nil && boulder != nil {
			_ = boulder
		}
	}

	// Handle graceful shutdown on OS signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Start the log watcher which returns a channel for log entries
	entryChan := w.Start()
	quitChan := make(chan struct{})

	var shutdownOnce sync.Once
	shutdown := func() {
		shutdownOnce.Do(func() {
			close(quitChan)
			w.Stop()
		})
	}

	// Main processing loop: consumes log entries and updates app state
	go func() {
		for {
			select {
			case entry := <-entryChan:
				if entry != nil {
					appState.UpdateFromLogEntry(entry)
				}
			case <-quitChan:
				return
			}
		}
	}()

	// Shutdown coordinator: waits for signal and stops the watcher
	go func() {
		<-sigChan
		shutdown()
		os.Exit(0)
	}()

	// Initialize and run the Bubble Tea TUI
	p := tea.NewProgram(uiModel, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		log.Fatalf("Error running program: %v", err)
	}

	shutdown()
}

func getDataDir() string {
	if xdgDataHome := os.Getenv("XDG_DATA_HOME"); xdgDataHome != "" {
		return filepath.Join(xdgDataHome, "opencode")
	}

	home, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("Failed to get home directory: %v", err)
	}

	return filepath.Join(home, ".local", "share", "opencode")
}
