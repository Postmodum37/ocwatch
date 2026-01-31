package state

import (
	"sync"
	"time"

	"github.com/tomas/ocwatch/internal/parser"
	"github.com/tomas/ocwatch/internal/session"
)

// AgentInfo represents information about an agent in the tree
type AgentInfo struct {
	Name   string
	Mode   string
	Active bool
}

// ToolCall represents a tool call event
type ToolCall struct {
	Name      string
	Timestamp time.Time
	SessionID string
}

// RingBuffer is a fixed-size circular buffer
type RingBuffer struct {
	data     []interface{}
	size     int
	capacity int
	index    int
}

// NewRingBuffer creates a new ring buffer with given capacity
func NewRingBuffer(capacity int) *RingBuffer {
	return &RingBuffer{
		data:     make([]interface{}, capacity),
		capacity: capacity,
		size:     0,
		index:    0,
	}
}

// Add adds an item to the ring buffer, overwriting oldest if full
func (rb *RingBuffer) Add(item interface{}) {
	rb.data[rb.index] = item
	rb.index = (rb.index + 1) % rb.capacity
	if rb.size < rb.capacity {
		rb.size++
	}
}

// GetAll returns all items in the ring buffer in order (oldest to newest)
func (rb *RingBuffer) GetAll() []interface{} {
	if rb.size == 0 {
		return []interface{}{}
	}

	result := make([]interface{}, 0, rb.size)

	// If buffer is full, oldest item is at current index
	// If buffer is not full, oldest item is at index 0
	startIdx := 0
	if rb.size == rb.capacity {
		startIdx = rb.index
	}

	for i := 0; i < rb.size; i++ {
		item := rb.data[(startIdx+i)%rb.capacity]
		if item != nil {
			result = append(result, item)
		}
	}
	return result
}

// State manages all application state with thread-safe access
type State struct {
	mu                sync.RWMutex
	sessions          map[string]*session.Session
	agentTrees        map[string][]AgentInfo
	callCounts        map[string]int
	recentLogs        *RingBuffer
	recentToolCalls   *RingBuffer
	allSessions       []session.Session
	selectedSessionID string
}

// NewState creates a new State instance with initialized fields
func NewState() *State {
	return &State{
		sessions:        make(map[string]*session.Session),
		agentTrees:      make(map[string][]AgentInfo),
		callCounts:      make(map[string]int),
		recentLogs:      NewRingBuffer(1000),
		recentToolCalls: NewRingBuffer(1000),
	}
}

// AddSession adds or updates a session in the state
func (s *State) AddSession(sess *session.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[sess.ID] = sess
}

// UpdateFromLogEntry updates state based on a parsed log entry
func (s *State) UpdateFromLogEntry(entry *parser.LogEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Add to recent logs
	s.recentLogs.Add(entry)

	// Update call counts if ModelID is present
	if entry.ModelID != "" {
		s.callCounts[entry.ModelID]++
	}

	// Update agent tree if SessionID and Agent are present
	if entry.SessionID != "" && entry.Agent != "" {
		agents := s.agentTrees[entry.SessionID]

		// Check if agent already exists
		found := false
		for i, agent := range agents {
			if agent.Name == entry.Agent {
				agents[i].Mode = entry.Mode
				agents[i].Active = true
				found = true
				break
			}
		}

		// Add new agent if not found
		if !found {
			agents = append(agents, AgentInfo{
				Name:   entry.Agent,
				Mode:   entry.Mode,
				Active: true,
			})
		}

		s.agentTrees[entry.SessionID] = agents
	}
}

// AddToolCall adds a tool call to the recent tool calls buffer
func (s *State) AddToolCall(tc *ToolCall) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.recentToolCalls.Add(tc)
}

// GetCallCounts returns a copy of the model call counts
func (s *State) GetCallCounts() map[string]int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]int)
	for k, v := range s.callCounts {
		result[k] = v
	}
	return result
}

// GetRecentLogs returns recent log entries from the ring buffer
func (s *State) GetRecentLogs() []*parser.LogEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	items := s.recentLogs.GetAll()
	result := make([]*parser.LogEntry, 0, len(items))
	for _, item := range items {
		if item != nil {
			if entry, ok := item.(*parser.LogEntry); ok {
				result = append(result, entry)
			}
		}
	}
	return result
}

// GetRecentToolCalls returns recent tool calls from the ring buffer
func (s *State) GetRecentToolCalls() []*ToolCall {
	s.mu.RLock()
	defer s.mu.RUnlock()

	items := s.recentToolCalls.GetAll()
	result := make([]*ToolCall, 0, len(items))
	for _, item := range items {
		if item != nil {
			if tc, ok := item.(*ToolCall); ok {
				result = append(result, tc)
			}
		}
	}
	return result
}

// GetAgentTree returns the agent tree for a given session
func (s *State) GetAgentTree(sessionID string) []AgentInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	agents := s.agentTrees[sessionID]
	// Return a copy to prevent external modification
	result := make([]AgentInfo, len(agents))
	copy(result, agents)
	return result
}

// GetSession returns a session by ID
func (s *State) GetSession(sessionID string) (*session.Session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sess, ok := s.sessions[sessionID]
	return sess, ok
}

// GetAllSessions returns all sessions
func (s *State) GetAllSessions() map[string]*session.Session {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]*session.Session)
	for k, v := range s.sessions {
		result[k] = v
	}
	return result
}

// SetAllSessions sets the list of all sessions
func (s *State) SetAllSessions(sessions []session.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.allSessions = sessions
}

// SetSelectedSession sets the currently selected session ID
func (s *State) SetSelectedSession(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.selectedSessionID = sessionID
}

// GetSelectedSession returns the currently selected session ID
func (s *State) GetSelectedSession() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.selectedSessionID
}

// GetFilteredAgentTree returns agents filtered by sessionID, or all agents if sessionID is empty
func (s *State) GetFilteredAgentTree(sessionID string) []AgentInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if sessionID == "" {
		var allAgents []AgentInfo
		for _, agents := range s.agentTrees {
			allAgents = append(allAgents, agents...)
		}
		return allAgents
	}

	agents := s.agentTrees[sessionID]
	result := make([]AgentInfo, len(agents))
	copy(result, agents)
	return result
}

// GetFilteredToolCalls returns tool calls filtered by sessionID, or all tool calls if sessionID is empty
func (s *State) GetFilteredToolCalls(sessionID string) []*ToolCall {
	s.mu.RLock()
	defer s.mu.RUnlock()

	items := s.recentToolCalls.GetAll()
	result := make([]*ToolCall, 0, len(items))

	for _, item := range items {
		if item != nil {
			if tc, ok := item.(*ToolCall); ok {
				if sessionID == "" || tc.SessionID == sessionID {
					result = append(result, tc)
				}
			}
		}
	}

	return result
}
