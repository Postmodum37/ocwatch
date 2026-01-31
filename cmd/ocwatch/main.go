package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/tomas/ocwatch/internal/session"
	"github.com/tomas/ocwatch/internal/state"
	"github.com/tomas/ocwatch/internal/ui"
	"github.com/tomas/ocwatch/internal/watcher"
)

func main() {
	dataDir := flag.String("data-dir", "", "Path to OpenCode data directory (default: ~/.local/share/opencode)")
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

	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	entryChan := w.Start()

	var shutdownOnce sync.Once
	shutdown := func() {
		shutdownOnce.Do(func() {
			cancel()
			w.Stop()

			shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer shutdownCancel()

			done := make(chan struct{})
			go func() {
				wg.Wait()
				close(done)
			}()

			select {
			case <-done:
			case <-shutdownCtx.Done():
				log.Println("Warning: goroutines did not exit within timeout")
			}
		})
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case entry := <-entryChan:
				if entry != nil {
					appState.UpdateFromLogEntry(entry)
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		<-sigChan
		shutdown()
		os.Exit(0)
	}()

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
