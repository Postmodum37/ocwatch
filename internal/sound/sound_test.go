package sound

import (
	"os/exec"
	"testing"
)

func TestSoundEventMapping(t *testing.T) {
	tests := []struct {
		event SoundEvent
		want  string
	}{
		{AgentStarted, "/System/Library/Sounds/Ping.aiff"},
		{AgentCompleted, "/System/Library/Sounds/Glass.aiff"},
		{AgentError, "/System/Library/Sounds/Basso.aiff"},
		{QuestionWaiting, "/System/Library/Sounds/Tink.aiff"},
		{TaskCompleted, "/System/Library/Sounds/Glass.aiff"},
		{PlanFinished, "/System/Library/Sounds/Glass.aiff"},
	}

	for _, tt := range tests {
		t.Run(tt.event.String(), func(t *testing.T) {
			got := eventToSound(tt.event)
			if got != tt.want {
				t.Errorf("eventToSound(%v) = %q, want %q", tt.event, got, tt.want)
			}
		})
	}
}

func TestNewSoundManager(t *testing.T) {
	sm := NewSoundManager()
	if sm == nil {
		t.Fatal("NewSoundManager() returned nil")
	}
	if sm.IsMuted() {
		t.Error("NewSoundManager() should not be muted by default")
	}
}

func TestSetMuted(t *testing.T) {
	sm := NewSoundManager()

	sm.SetMuted(true)
	if !sm.IsMuted() {
		t.Error("SetMuted(true) failed, IsMuted() returned false")
	}

	sm.SetMuted(false)
	if sm.IsMuted() {
		t.Error("SetMuted(false) failed, IsMuted() returned true")
	}
}

func TestPlayWhenMuted(t *testing.T) {
	sm := NewSoundManager()
	sm.SetMuted(true)

	// Mock the command execution
	execCommandMu.Lock()
	originalExecCommand := execCommand
	execCommand = func(name string, arg ...string) *exec.Cmd {
		return exec.Command("echo", "should not be called")
	}
	execCommandMu.Unlock()
	defer func() {
		execCommandMu.Lock()
		execCommand = originalExecCommand
		execCommandMu.Unlock()
	}()

	// Should not panic and should not call afplay
	sm.Play(AgentCompleted)
}

func TestPlayWhenNotMuted(t *testing.T) {
	sm := NewSoundManager()
	sm.SetMuted(false)

	// Mock the command execution
	execCommandMu.Lock()
	commandExecuted := make(chan bool, 1)
	var lastCommand string
	var lastArgs []string
	originalExecCommand := execCommand
	execCommand = func(name string, arg ...string) *exec.Cmd {
		lastCommand = name
		lastArgs = arg
		commandExecuted <- true
		return exec.Command("echo", "mocked")
	}
	execCommandMu.Unlock()
	defer func() {
		execCommandMu.Lock()
		execCommand = originalExecCommand
		execCommandMu.Unlock()
	}()

	sm.Play(AgentCompleted)

	// Wait for goroutine to execute
	<-commandExecuted

	if lastCommand != "afplay" {
		t.Errorf("Expected command 'afplay', got %q", lastCommand)
	}
	if len(lastArgs) == 0 {
		t.Error("Expected sound path argument")
	}
}

func TestPlayAllEvents(t *testing.T) {
	sm := NewSoundManager()
	sm.SetMuted(false)

	// Mock the command execution
	execCommandMu.Lock()
	originalExecCommand := execCommand
	execCommand = func(name string, arg ...string) *exec.Cmd {
		return exec.Command("echo", "mocked")
	}
	execCommandMu.Unlock()
	defer func() {
		execCommandMu.Lock()
		execCommand = originalExecCommand
		execCommandMu.Unlock()
	}()

	events := []SoundEvent{
		AgentStarted,
		AgentCompleted,
		AgentError,
		QuestionWaiting,
		TaskCompleted,
		PlanFinished,
	}

	for _, event := range events {
		sm.Play(event)
	}
}

func TestMuteToggle(t *testing.T) {
	sm := NewSoundManager()

	// Test multiple toggles
	for i := 0; i < 5; i++ {
		sm.SetMuted(true)
		if !sm.IsMuted() {
			t.Errorf("Iteration %d: SetMuted(true) failed", i)
		}

		sm.SetMuted(false)
		if sm.IsMuted() {
			t.Errorf("Iteration %d: SetMuted(false) failed", i)
		}
	}
}
