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

func TestToolCallHasSessionID(t *testing.T) {
	tc := &ToolCall{
		Name:      "test_tool",
		Timestamp: time.Now(),
		SessionID: "session-123",
	}

	if tc.SessionID != "session-123" {
		t.Errorf("expected SessionID 'session-123', got '%s'", tc.SessionID)
	}
}

func TestGetAgentTreeFiltered(t *testing.T) {
	s := NewState()

	// Add agents for different sessions
	entry1 := &parser.LogEntry{
		Timestamp: time.Now(),
		SessionID: "session-1",
		Agent:     "agent-1",
		Mode:      "mode-1",
	}
	entry2 := &parser.LogEntry{
		Timestamp: time.Now(),
		SessionID: "session-2",
		Agent:     "agent-2",
		Mode:      "mode-2",
	}
	entry3 := &parser.LogEntry{
		Timestamp: time.Now(),
		SessionID: "session-1",
		Agent:     "agent-3",
		Mode:      "mode-3",
	}

	s.UpdateFromLogEntry(entry1)
	s.UpdateFromLogEntry(entry2)
	s.UpdateFromLogEntry(entry3)

	// Test filtering by session-1
	agents := s.GetFilteredAgentTree("session-1")
	if len(agents) != 2 {
		t.Errorf("expected 2 agents for session-1, got %d", len(agents))
	}

	// Verify correct agents are returned
	foundAgent1 := false
	foundAgent3 := false
	for _, agent := range agents {
		if agent.Name == "agent-1" {
			foundAgent1 = true
		}
		if agent.Name == "agent-3" {
			foundAgent3 = true
		}
	}
	if !foundAgent1 || !foundAgent3 {
		t.Error("expected to find agent-1 and agent-3 for session-1")
	}

	// Test filtering by session-2
	agents = s.GetFilteredAgentTree("session-2")
	if len(agents) != 1 {
		t.Errorf("expected 1 agent for session-2, got %d", len(agents))
	}
	if agents[0].Name != "agent-2" {
		t.Errorf("expected agent-2 for session-2, got %s", agents[0].Name)
	}

	// Test empty sessionID returns all agents
	agents = s.GetFilteredAgentTree("")
	if len(agents) != 3 {
		t.Errorf("expected 3 agents for empty sessionID, got %d", len(agents))
	}
}

func TestGetRecentToolCallsFiltered(t *testing.T) {
	s := NewState()

	// Add tool calls for different sessions
	tc1 := &ToolCall{
		Name:      "tool-1",
		Timestamp: time.Now(),
		SessionID: "session-1",
	}
	tc2 := &ToolCall{
		Name:      "tool-2",
		Timestamp: time.Now(),
		SessionID: "session-2",
	}
	tc3 := &ToolCall{
		Name:      "tool-3",
		Timestamp: time.Now(),
		SessionID: "session-1",
	}

	s.AddToolCall(tc1)
	s.AddToolCall(tc2)
	s.AddToolCall(tc3)

	// Test filtering by session-1
	calls := s.GetFilteredToolCalls("session-1")
	if len(calls) != 2 {
		t.Errorf("expected 2 tool calls for session-1, got %d", len(calls))
	}

	// Verify correct tool calls are returned
	foundTool1 := false
	foundTool3 := false
	for _, call := range calls {
		if call.Name == "tool-1" {
			foundTool1 = true
		}
		if call.Name == "tool-3" {
			foundTool3 = true
		}
	}
	if !foundTool1 || !foundTool3 {
		t.Error("expected to find tool-1 and tool-3 for session-1")
	}

	// Test filtering by session-2
	calls = s.GetFilteredToolCalls("session-2")
	if len(calls) != 1 {
		t.Errorf("expected 1 tool call for session-2, got %d", len(calls))
	}
	if calls[0].Name != "tool-2" {
		t.Errorf("expected tool-2 for session-2, got %s", calls[0].Name)
	}

	// Test empty sessionID returns all tool calls
	calls = s.GetFilteredToolCalls("")
	if len(calls) != 3 {
		t.Errorf("expected 3 tool calls for empty sessionID, got %d", len(calls))
	}
}

func TestTypeAssertionSafe(t *testing.T) {
	s := NewState()

	// Manually inject wrong type into ring buffer to test safe assertion
	// This simulates a defensive scenario where wrong type ends up in buffer
	s.recentLogs.Add("wrong-type-string")
	s.recentLogs.Add(&parser.LogEntry{
		Timestamp: time.Now(),
		Service:   "test",
		ModelID:   "gpt-4",
	})

	// GetRecentLogs should skip the wrong type and not panic
	logs := s.GetRecentLogs()
	if len(logs) != 1 {
		t.Errorf("expected 1 valid log entry (wrong type skipped), got %d", len(logs))
	}
	if logs[0].ModelID != "gpt-4" {
		t.Errorf("expected gpt-4, got %s", logs[0].ModelID)
	}

	// Test GetRecentToolCalls with wrong type
	s.recentToolCalls.Add(123) // wrong type: int
	s.recentToolCalls.Add(&ToolCall{
		Name:      "test-tool",
		Timestamp: time.Now(),
		SessionID: "session-1",
	})

	// GetRecentToolCalls should skip the wrong type and not panic
	calls := s.GetRecentToolCalls()
	if len(calls) != 1 {
		t.Errorf("expected 1 valid tool call (wrong type skipped), got %d", len(calls))
	}
	if calls[0].Name != "test-tool" {
		t.Errorf("expected test-tool, got %s", calls[0].Name)
	}

	// Test GetFilteredToolCalls with wrong type
	filtered := s.GetFilteredToolCalls("session-1")
	if len(filtered) != 1 {
		t.Errorf("expected 1 valid filtered tool call, got %d", len(filtered))
	}
	if filtered[0].Name != "test-tool" {
		t.Errorf("expected test-tool, got %s", filtered[0].Name)
	}
}
