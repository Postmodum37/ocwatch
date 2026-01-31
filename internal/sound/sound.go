package sound

import (
	"os/exec"
	"sync"
)

// SoundEvent represents different sound notification events
type SoundEvent int

const (
	AgentStarted SoundEvent = iota
	AgentCompleted
	AgentError
	QuestionWaiting
	TaskCompleted
	PlanFinished
)

// String returns the string representation of a SoundEvent
func (se SoundEvent) String() string {
	switch se {
	case AgentStarted:
		return "AgentStarted"
	case AgentCompleted:
		return "AgentCompleted"
	case AgentError:
		return "AgentError"
	case QuestionWaiting:
		return "QuestionWaiting"
	case TaskCompleted:
		return "TaskCompleted"
	case PlanFinished:
		return "PlanFinished"
	default:
		return "Unknown"
	}
}

// SoundManager handles audio notifications for macOS
type SoundManager struct {
	muted bool
	mu    sync.RWMutex
}

// NewSoundManager creates a new SoundManager instance
func NewSoundManager() *SoundManager {
	return &SoundManager{
		muted: false,
	}
}

// Play plays a sound for the given event (non-blocking)
func (sm *SoundManager) Play(event SoundEvent) {
	sm.mu.RLock()
	muted := sm.muted
	sm.mu.RUnlock()

	if muted {
		return
	}

	soundPath := eventToSound(event)

	// Play sound in goroutine to avoid blocking
	go func() {
		execCommandMu.RLock()
		cmd := execCommand("afplay", soundPath)
		execCommandMu.RUnlock()
		_ = cmd.Run()
	}()
}

// SetMuted sets the mute state
func (sm *SoundManager) SetMuted(muted bool) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.muted = muted
}

// IsMuted returns the current mute state
func (sm *SoundManager) IsMuted() bool {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.muted
}

// eventToSound maps a SoundEvent to a system sound file path
func eventToSound(event SoundEvent) string {
	switch event {
	case AgentStarted:
		return "/System/Library/Sounds/Ping.aiff"
	case AgentCompleted:
		return "/System/Library/Sounds/Glass.aiff"
	case AgentError:
		return "/System/Library/Sounds/Basso.aiff"
	case QuestionWaiting:
		return "/System/Library/Sounds/Tink.aiff"
	case TaskCompleted:
		return "/System/Library/Sounds/Glass.aiff"
	case PlanFinished:
		return "/System/Library/Sounds/Glass.aiff"
	default:
		return "/System/Library/Sounds/Ping.aiff"
	}
}

// execCommand is a variable that can be mocked in tests
var execCommand = exec.Command
var execCommandMu sync.RWMutex
