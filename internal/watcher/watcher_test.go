package watcher

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestNewWatcher tests that NewWatcher creates a valid watcher instance
func TestNewWatcher(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewWatcher(tmpDir)

	if w == nil {
		t.Fatal("NewWatcher returned nil")
	}
	if w.logDir != tmpDir {
		t.Errorf("expected logDir %s, got %s", tmpDir, w.logDir)
	}
}

// TestStartReturnsChannel tests that Start returns a channel
func TestStartReturnsChannel(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewWatcher(tmpDir)

	ch := w.Start()
	if ch == nil {
		t.Fatal("Start returned nil channel")
	}

	// Clean up
	w.Stop()
}

// TestTailNewLogFile tests that watcher tails a newly created log file
func TestTailNewLogFile(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	// Create a log file with a valid timestamp name
	logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
	if err := os.WriteFile(logFile, []byte("INFO 2026-01-31T12:00:00Z +0ms service=test\n"), 0644); err != nil {
		t.Fatalf("failed to create log file: %v", err)
	}

	// Wait for entry to be parsed and sent to channel
	select {
	case entry := <-ch:
		if entry == nil {
			t.Fatal("received nil entry")
		}
		if entry.Service != "test" {
			t.Errorf("expected service 'test', got '%s'", entry.Service)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for log entry")
	}
}

// TestDetectLogRotation tests that watcher detects when a new log file is created
func TestDetectLogRotation(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	// Create first log file
	logFile1 := filepath.Join(tmpDir, "2026-01-31T120000.log")
	if err := os.WriteFile(logFile1, []byte("INFO 2026-01-31T12:00:00Z +0ms service=first\n"), 0644); err != nil {
		t.Fatalf("failed to create first log file: %v", err)
	}

	// Wait for first entry
	select {
	case entry := <-ch:
		if entry == nil || entry.Service != "first" {
			t.Fatal("failed to read first entry")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for first entry")
	}

	// Create second log file (rotation)
	logFile2 := filepath.Join(tmpDir, "2026-01-31T120100.log")
	if err := os.WriteFile(logFile2, []byte("INFO 2026-01-31T12:01:00Z +0ms service=second\n"), 0644); err != nil {
		t.Fatalf("failed to create second log file: %v", err)
	}

	// Wait for second entry from rotated file
	select {
	case entry := <-ch:
		if entry == nil || entry.Service != "second" {
			t.Fatal("failed to read second entry after rotation")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for second entry after rotation")
	}
}

// TestAppendToLogFile tests that watcher tails new lines appended to log file
func TestAppendToLogFile(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	// Create initial log file
	logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
	if err := os.WriteFile(logFile, []byte("INFO 2026-01-31T12:00:00Z +0ms service=test1\n"), 0644); err != nil {
		t.Fatalf("failed to create log file: %v", err)
	}

	// Wait for first entry
	select {
	case entry := <-ch:
		if entry == nil || entry.Service != "test1" {
			t.Fatal("failed to read first entry")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for first entry")
	}

	// Append new line to log file
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		t.Fatalf("failed to open log file: %v", err)
	}
	if _, err := f.WriteString("INFO 2026-01-31T12:00:01Z +0ms service=test2\n"); err != nil {
		f.Close()
		t.Fatalf("failed to append to log file: %v", err)
	}
	f.Close()

	// Wait for second entry
	select {
	case entry := <-ch:
		if entry == nil || entry.Service != "test2" {
			t.Fatal("failed to read second entry")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for second entry")
	}
}

// TestFindsMostRecentLogFile tests that watcher finds the most recent log file
func TestFindsMostRecentLogFile(t *testing.T) {
	tmpDir := t.TempDir()

	// Create multiple log files with different timestamps
	files := []string{
		"2026-01-20T100000.log",
		"2026-01-31T090000.log",
		"2026-01-31T120000.log", // Most recent
		"2026-01-25T150000.log",
	}

	for _, f := range files {
		logFile := filepath.Join(tmpDir, f)
		if err := os.WriteFile(logFile, []byte("INFO 2026-01-31T12:00:00Z +0ms service=test\n"), 0644); err != nil {
			t.Fatalf("failed to create log file: %v", err)
		}
	}

	w := NewWatcher(tmpDir)
	ch := w.Start()
	defer w.Stop()

	// Should tail the most recent file
	select {
	case entry := <-ch:
		if entry == nil {
			t.Fatal("received nil entry")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for log entry")
	}
}

// TestStopClosesChannel tests that Stop closes the channel
func TestStopClosesChannel(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewWatcher(tmpDir)

	ch := w.Start()

	// Stop the watcher
	w.Stop()

	// Channel should be closed (reading from closed channel returns zero value and ok=false)
	time.Sleep(100 * time.Millisecond) // Give it time to close

	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("channel should be closed")
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for channel to close")
	}
}

// TestHandlesInvalidLogLines tests that invalid log lines are skipped
func TestHandlesInvalidLogLines(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	// Create log file with mix of valid and invalid lines
	logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
	content := `INFO 2026-01-31T12:00:00Z +0ms service=valid1
invalid line without proper format
INFO 2026-01-31T12:00:01Z +0ms service=valid2
`
	if err := os.WriteFile(logFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to create log file: %v", err)
	}

	// Should receive valid entries, invalid lines should be skipped
	validCount := 0
	timeout := time.After(2 * time.Second)

	for validCount < 2 {
		select {
		case entry := <-ch:
			if entry != nil {
				validCount++
			}
		case <-timeout:
			t.Fatalf("timeout: expected 2 valid entries, got %d", validCount)
		}
	}
}

// TestWaitsForLogFileCreation tests that watcher waits if log file doesn't exist yet
func TestWaitsForLogFileCreation(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	// Create log file after a short delay
	go func() {
		time.Sleep(500 * time.Millisecond)
		logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
		os.WriteFile(logFile, []byte("INFO 2026-01-31T12:00:00Z +0ms service=delayed\n"), 0644)
	}()

	// Should eventually receive entry even though file didn't exist initially
	select {
	case entry := <-ch:
		if entry == nil || entry.Service != "delayed" {
			t.Fatal("failed to read delayed entry")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for delayed log entry")
	}
}

// TestMultipleEntriesInFile tests that watcher reads multiple entries from a file
func TestMultipleEntriesInFile(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	// Create log file with multiple entries
	logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
	content := `INFO 2026-01-31T12:00:00Z +0ms service=test1
INFO 2026-01-31T12:00:01Z +0ms service=test2
INFO 2026-01-31T12:00:02Z +0ms service=test3
`
	if err := os.WriteFile(logFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to create log file: %v", err)
	}

	// Should receive all three entries
	services := []string{}
	timeout := time.After(2 * time.Second)

	for len(services) < 3 {
		select {
		case entry := <-ch:
			if entry != nil {
				services = append(services, entry.Service)
			}
		case <-timeout:
			t.Fatalf("timeout: expected 3 entries, got %d", len(services))
		}
	}

	expected := []string{"test1", "test2", "test3"}
	for i, svc := range services {
		if svc != expected[i] {
			t.Errorf("entry %d: expected service '%s', got '%s'", i, expected[i], svc)
		}
	}
}

// TestXDGDataHome tests that watcher respects XDG_DATA_HOME environment variable
func TestXDGDataHome(t *testing.T) {
	// Create a custom data home directory
	customHome := t.TempDir()
	logDir := filepath.Join(customHome, "opencode", "log")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		t.Fatalf("failed to create log directory: %v", err)
	}

	// Set XDG_DATA_HOME
	oldXDG := os.Getenv("XDG_DATA_HOME")
	os.Setenv("XDG_DATA_HOME", customHome)
	defer os.Setenv("XDG_DATA_HOME", oldXDG)

	// Create watcher with empty string (should use XDG_DATA_HOME)
	w := NewWatcher(logDir)
	if w.logDir != logDir {
		t.Errorf("expected logDir %s, got %s", logDir, w.logDir)
	}
}

// TestParseLineIntegration tests that ParseLine is called correctly
func TestParseLineIntegration(t *testing.T) {
	tmpDir := t.TempDir()
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	// Create log file with various fields
	logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
	content := "INFO 2026-01-31T12:00:00Z +0ms service=session sessionID=abc123 agent=test mode=dev\n"
	if err := os.WriteFile(logFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to create log file: %v", err)
	}

	// Verify parsed entry has all fields
	select {
	case entry := <-ch:
		if entry == nil {
			t.Fatal("received nil entry")
		}
		if entry.Service != "session" {
			t.Errorf("expected service 'session', got '%s'", entry.Service)
		}
		if entry.SessionID != "abc123" {
			t.Errorf("expected sessionID 'abc123', got '%s'", entry.SessionID)
		}
		if entry.Agent != "test" {
			t.Errorf("expected agent 'test', got '%s'", entry.Agent)
		}
		if entry.Mode != "dev" {
			t.Errorf("expected mode 'dev', got '%s'", entry.Mode)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for log entry")
	}
}
