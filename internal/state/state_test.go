package state

import (
	"sync"
	"testing"
	"time"

	"github.com/tomas/ocwatch/internal/parser"
	"github.com/tomas/ocwatch/internal/session"
)

func TestNewState(t *testing.T) {
	s := NewState()
	if s == nil {
		t.Fatal("NewState returned nil")
	}
	if s.sessions == nil {
		t.Fatal("sessions map not initialized")
	}
	if s.agentTrees == nil {
		t.Fatal("agentTrees map not initialized")
	}
	if s.callCounts == nil {
		t.Fatal("callCounts map not initialized")
	}
	if s.recentLogs == nil {
		t.Fatal("recentLogs ring buffer not initialized")
	}
	if s.recentToolCalls == nil {
		t.Fatal("recentToolCalls ring buffer not initialized")
	}
}

func TestAddSession(t *testing.T) {
	s := NewState()
	sess := &session.Session{
		ID:        "test-session-1",
		Slug:      "test-slug",
		ProjectID: "test-project",
		Directory: "/test/dir",
		Title:     "Test Session",
		Created:   time.Now(),
		Updated:   time.Now(),
	}

	s.AddSession(sess)

	retrieved, ok := s.sessions["test-session-1"]
	if !ok {
		t.Fatal("session not found after AddSession")
	}
	if retrieved.ID != sess.ID {
		t.Errorf("session ID mismatch: got %s, want %s", retrieved.ID, sess.ID)
	}
}

func TestGetCallCounts(t *testing.T) {
	s := NewState()

	// Initially empty
	counts := s.GetCallCounts()
	if len(counts) != 0 {
		t.Errorf("expected empty call counts, got %d entries", len(counts))
	}

	// Add some entries
	entry1 := &parser.LogEntry{
		Timestamp: time.Now(),
		ModelID:   "gpt-4",
		Service:   "test",
	}
	entry2 := &parser.LogEntry{
		Timestamp: time.Now(),
		ModelID:   "gpt-4",
		Service:   "test",
	}
	entry3 := &parser.LogEntry{
		Timestamp: time.Now(),
		ModelID:   "claude-3",
		Service:   "test",
	}

	s.UpdateFromLogEntry(entry1)
	s.UpdateFromLogEntry(entry2)
	s.UpdateFromLogEntry(entry3)

	counts = s.GetCallCounts()
	if counts["gpt-4"] != 2 {
		t.Errorf("expected gpt-4 count 2, got %d", counts["gpt-4"])
	}
	if counts["claude-3"] != 1 {
		t.Errorf("expected claude-3 count 1, got %d", counts["claude-3"])
	}
}

func TestUpdateFromLogEntry(t *testing.T) {
	s := NewState()

	entry := &parser.LogEntry{
		Timestamp:  time.Now(),
		Service:    "test-service",
		ProviderID: "provider-1",
		ModelID:    "gpt-4",
		SessionID:  "session-1",
		Agent:      "test-agent",
		Mode:       "test-mode",
	}

	s.UpdateFromLogEntry(entry)

	// Check that log entry was added
	logs := s.GetRecentLogs()
	if len(logs) != 1 {
		t.Errorf("expected 1 log entry, got %d", len(logs))
	}
	if logs[0].ModelID != "gpt-4" {
		t.Errorf("log entry ModelID mismatch: got %s, want gpt-4", logs[0].ModelID)
	}

	// Check that call count was incremented
	counts := s.GetCallCounts()
	if counts["gpt-4"] != 1 {
		t.Errorf("expected call count 1, got %d", counts["gpt-4"])
	}

	// Check that agent tree was updated
	agents := s.GetAgentTree("session-1")
	if len(agents) == 0 {
		t.Fatal("expected agent tree to be populated")
	}
	found := false
	for _, agent := range agents {
		if agent.Name == "test-agent" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("test-agent not found in agent tree")
	}
}

func TestGetRecentLogs(t *testing.T) {
	s := NewState()

	// Add entries up to capacity
	for i := 0; i < 1050; i++ {
		entry := &parser.LogEntry{
			Timestamp: time.Now().Add(time.Duration(i) * time.Second),
			Service:   "test",
			ModelID:   "gpt-4",
		}
		s.UpdateFromLogEntry(entry)
	}

	logs := s.GetRecentLogs()
	if len(logs) != 1000 {
		t.Errorf("expected 1000 log entries (ring buffer capacity), got %d", len(logs))
	}

	// Verify oldest entries were overwritten
	// The first 50 entries should be gone, so we should have entries 50-1049
	if logs[0].Timestamp.Before(time.Now().Add(time.Duration(49) * time.Second)) {
		t.Error("oldest entries not properly overwritten in ring buffer")
	}
}

func TestGetRecentToolCalls(t *testing.T) {
	s := NewState()

	// Add tool calls
	for i := 0; i < 100; i++ {
		tc := &ToolCall{
			Name:      "test_tool",
			Timestamp: time.Now().Add(time.Duration(i) * time.Second),
		}
		s.AddToolCall(tc)
	}

	calls := s.GetRecentToolCalls()
	if len(calls) != 100 {
		t.Errorf("expected 100 tool calls, got %d", len(calls))
	}
}

func TestGetAgentTree(t *testing.T) {
	s := NewState()

	entry := &parser.LogEntry{
		Timestamp: time.Now(),
		SessionID: "session-1",
		Agent:     "agent-1",
		Mode:      "mode-1",
	}

	s.UpdateFromLogEntry(entry)

	agents := s.GetAgentTree("session-1")
	if len(agents) == 0 {
		t.Fatal("expected agent tree to be populated")
	}
	if agents[0].Name != "agent-1" {
		t.Errorf("expected agent name agent-1, got %s", agents[0].Name)
	}
	if agents[0].Mode != "mode-1" {
		t.Errorf("expected mode mode-1, got %s", agents[0].Mode)
	}
}

func TestConcurrentUpdates(t *testing.T) {
	s := NewState()
	numGoroutines := 10
	entriesPerGoroutine := 100

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	for g := 0; g < numGoroutines; g++ {
		go func(goroutineID int) {
			defer wg.Done()
			for i := 0; i < entriesPerGoroutine; i++ {
				entry := &parser.LogEntry{
					Timestamp: time.Now(),
					Service:   "test",
					ModelID:   "gpt-4",
					SessionID: "session-1",
					Agent:     "agent-1",
				}
				s.UpdateFromLogEntry(entry)
			}
		}(g)
	}

	wg.Wait()

	counts := s.GetCallCounts()
	expectedCount := numGoroutines * entriesPerGoroutine
	if counts["gpt-4"] != expectedCount {
		t.Errorf("expected call count %d, got %d", expectedCount, counts["gpt-4"])
	}

	logs := s.GetRecentLogs()
	if len(logs) != expectedCount {
		t.Errorf("expected %d log entries, got %d", expectedCount, len(logs))
	}
}

func TestRingBufferOverflow(t *testing.T) {
	s := NewState()

	// Add more than capacity
	for i := 0; i < 1500; i++ {
		entry := &parser.LogEntry{
			Timestamp: time.Now().Add(time.Duration(i) * time.Millisecond),
			Service:   "test",
			ModelID:   "gpt-4",
		}
		s.UpdateFromLogEntry(entry)
	}

	logs := s.GetRecentLogs()
	if len(logs) != 1000 {
		t.Errorf("ring buffer should maintain max capacity of 1000, got %d", len(logs))
	}
}

func TestThreadSafetyWithRaceDetector(t *testing.T) {
	s := NewState()

	// This test is designed to be run with -race flag
	// It will detect any data races in concurrent access

	var wg sync.WaitGroup
	wg.Add(3)

	// Goroutine 1: Add sessions
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			sess := &session.Session{
				ID:        "session-" + string(rune(i)),
				Slug:      "slug",
				ProjectID: "project",
				Directory: "/dir",
				Title:     "Title",
				Created:   time.Now(),
				Updated:   time.Now(),
			}
			s.AddSession(sess)
		}
	}()

	// Goroutine 2: Update from log entries
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			entry := &parser.LogEntry{
				Timestamp: time.Now(),
				Service:   "test",
				ModelID:   "gpt-4",
				SessionID: "session-1",
				Agent:     "agent-1",
			}
			s.UpdateFromLogEntry(entry)
		}
	}()

	// Goroutine 3: Read state
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			_ = s.GetCallCounts()
			_ = s.GetRecentLogs()
			_ = s.GetAgentTree("session-1")
		}
	}()

	wg.Wait()
}
