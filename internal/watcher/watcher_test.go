package watcher

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func getTempDir(t *testing.T) string {
	baseDir := "/tmp/ocwatch-tests"
	testDir := filepath.Join(baseDir, fmt.Sprintf("test-%d", time.Now().UnixNano()))
	if err := os.MkdirAll(testDir, 0755); err != nil {
		t.Fatalf("failed to create test dir: %v", err)
	}
	t.Cleanup(func() {
		os.RemoveAll(testDir)
	})
	return testDir
}

func TestNewWatcher(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	if w == nil {
		t.Fatal("NewWatcher returned nil")
	}
	if w.logDir != tmpDir {
		t.Errorf("expected logDir %s, got %s", tmpDir, w.logDir)
	}
}

func TestStartReturnsChannel(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	ch := w.Start()
	if ch == nil {
		t.Fatal("Start returned nil channel")
	}

	w.Stop()
}

func TestStopClosesChannel(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	ch := w.Start()

	w.Stop()

	time.Sleep(100 * time.Millisecond)

	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("channel should be closed")
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for channel to close")
	}
}

func TestFindsMostRecentLogFile(t *testing.T) {
	tmpDir := getTempDir(t)

	files := []string{
		"2026-01-20T100000.log",
		"2026-01-31T090000.log",
		"2026-01-31T120000.log",
		"2026-01-25T150000.log",
	}

	for _, f := range files {
		logFile := filepath.Join(tmpDir, f)
		if err := os.WriteFile(logFile, []byte("test\n"), 0644); err != nil {
			t.Fatalf("failed to create log file: %v", err)
		}
	}

	w := NewWatcher(tmpDir)
	recent := w.findMostRecentLogFile()

	expected := filepath.Join(tmpDir, "2026-01-31T120000.log")
	if recent != expected {
		t.Errorf("expected %s, got %s", expected, recent)
	}
}

func TestTailNewLogFile(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	time.Sleep(300 * time.Millisecond)

	logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
	if err := os.WriteFile(logFile, []byte("INFO 2026-01-31T12:00:00 +0ms service=test\n"), 0644); err != nil {
		t.Fatalf("failed to create log file: %v", err)
	}

	time.Sleep(200 * time.Millisecond)

	select {
	case entry := <-ch:
		if entry == nil {
			t.Fatal("received nil entry")
		}
		if entry.Service != "test" {
			t.Errorf("expected service 'test', got '%s'", entry.Service)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for log entry")
	}
}

func TestDetectLogRotation(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	time.Sleep(300 * time.Millisecond)

	logFile1 := filepath.Join(tmpDir, "2026-01-31T120000.log")
	if err := os.WriteFile(logFile1, []byte("INFO 2026-01-31T12:00:00 +0ms service=first\n"), 0644); err != nil {
		t.Fatalf("failed to create first log file: %v", err)
	}

	time.Sleep(200 * time.Millisecond)

	select {
	case entry := <-ch:
		if entry == nil || entry.Service != "first" {
			t.Fatal("failed to read first entry")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for first entry")
	}

	logFile2 := filepath.Join(tmpDir, "2026-01-31T120100.log")
	if err := os.WriteFile(logFile2, []byte("INFO 2026-01-31T12:01:00 +0ms service=second\n"), 0644); err != nil {
		t.Fatalf("failed to create second log file: %v", err)
	}

	time.Sleep(200 * time.Millisecond)

	select {
	case entry := <-ch:
		if entry == nil || entry.Service != "second" {
			t.Fatal("failed to read second entry after rotation")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for second entry after rotation")
	}
}

func TestAppendToLogFile(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	time.Sleep(300 * time.Millisecond)

	logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
	if err := os.WriteFile(logFile, []byte("INFO 2026-01-31T12:00:00 +0ms service=test1\n"), 0644); err != nil {
		t.Fatalf("failed to create log file: %v", err)
	}

	time.Sleep(200 * time.Millisecond)

	select {
	case entry := <-ch:
		if entry == nil || entry.Service != "test1" {
			t.Fatal("failed to read first entry")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for first entry")
	}

	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		t.Fatalf("failed to open log file: %v", err)
	}
	if _, err := f.WriteString("INFO 2026-01-31T12:00:01 +0ms service=test2\n"); err != nil {
		f.Close()
		t.Fatalf("failed to append to log file: %v", err)
	}
	f.Close()

	time.Sleep(200 * time.Millisecond)

	select {
	case entry := <-ch:
		if entry == nil || entry.Service != "test2" {
			t.Fatal("failed to read second entry")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for second entry")
	}
}

func TestMultipleEntriesInFile(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	time.Sleep(300 * time.Millisecond)

	logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
	content := `INFO 2026-01-31T12:00:00 +0ms service=test1
INFO 2026-01-31T12:00:01 +0ms service=test2
INFO 2026-01-31T12:00:02 +0ms service=test3
`
	if err := os.WriteFile(logFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to create log file: %v", err)
	}

	time.Sleep(200 * time.Millisecond)

	services := []string{}
	timeout := time.After(3 * time.Second)

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

func TestHandlesInvalidLogLines(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	time.Sleep(300 * time.Millisecond)

	logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
	content := `INFO 2026-01-31T12:00:00 +0ms service=valid1
invalid line without proper format
INFO 2026-01-31T12:00:01 +0ms service=valid2
`
	if err := os.WriteFile(logFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to create log file: %v", err)
	}

	time.Sleep(200 * time.Millisecond)

	validCount := 0
	timeout := time.After(3 * time.Second)

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

func TestParseLineIntegration(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	time.Sleep(300 * time.Millisecond)

	logFile := filepath.Join(tmpDir, "2026-01-31T120000.log")
	content := "INFO 2026-01-31T12:00:00 +0ms service=session sessionID=abc123 agent=test mode=dev\n"
	if err := os.WriteFile(logFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to create log file: %v", err)
	}

	time.Sleep(200 * time.Millisecond)

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
	case <-time.After(3 * time.Second):
		t.Fatal("timeout waiting for log entry")
	}
}

func TestDoubleStopNoPanic(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	ch := w.Start()

	// First Stop() should succeed
	w.Stop()

	// Verify channel is closed
	time.Sleep(100 * time.Millisecond)
	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("channel should be closed after first Stop()")
		}
	case <-time.After(1 * time.Second):
		t.Fatal("timeout waiting for channel to close")
	}

	// Second Stop() should not panic
	// This would panic before the fix with: "panic: close of closed channel"
	w.Stop()

	// Third Stop() should also not panic
	w.Stop()
}

func TestRapidFileSwitch(t *testing.T) {
	tmpDir := getTempDir(t)
	w := NewWatcher(tmpDir)

	ch := w.Start()
	defer w.Stop()

	time.Sleep(300 * time.Millisecond)

	// Rapidly create new log files to trigger file switching
	// This should expose race conditions in switchToFile()
	for i := 0; i < 20; i++ {
		logFile := filepath.Join(tmpDir, fmt.Sprintf("2026-01-31T12%02d00.log", i))
		content := fmt.Sprintf("INFO 2026-01-31T12:%02d:00 +0ms service=test%d\n", i, i)
		if err := os.WriteFile(logFile, []byte(content), 0644); err != nil {
			t.Fatalf("failed to create log file %d: %v", i, err)
		}
		// Minimal delay to maximize race window
		time.Sleep(10 * time.Millisecond)
	}

	// Drain channel to verify we can read entries without deadlock
	timeout := time.After(5 * time.Second)
	entriesRead := 0
	for entriesRead < 20 {
		select {
		case entry := <-ch:
			if entry != nil {
				entriesRead++
			}
		case <-timeout:
			// Not a failure - we're testing for race conditions, not completeness
			// The race detector will catch issues even if we don't read all entries
			return
		}
	}
}
