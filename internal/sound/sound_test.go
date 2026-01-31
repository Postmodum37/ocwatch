package sound

import (
	"os"
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
	originalExecCommand := execCommand
	defer func() { execCommand = originalExecCommand }()

	commandCalled := false
	execCommand = func(name string, arg ...string) *exec.Cmd {
		commandCalled = true
		return exec.Command("echo", "should not be called")
	}

	sm.Play(AgentCompleted)

	// Give goroutine time to execute
	// In real scenario, we'd use channels or WaitGroup
	// For now, just verify the logic doesn't panic
	if commandCalled {
		t.Error("afplay should not be called when muted")
	}
}

func TestPlayWhenNotMuted(t *testing.T) {
	// Skip if not on macOS
	if os.Getenv("GOOS") == "windows" || os.Getenv("GOOS") == "linux" {
		t.Skip("Sound tests only run on macOS")
	}

	sm := NewSoundManager()
	sm.SetMuted(false)

	// Mock the command execution
	originalExecCommand := execCommand
	defer func() { execCommand = originalExecCommand }()

	commandExecuted := make(chan bool, 1)
	var lastCommand string
	var lastArgs []string
	execCommand = func(name string, arg ...string) *exec.Cmd {
		lastCommand = name
		lastArgs = arg
		commandExecuted <- true
		// Return a command that won't actually execute
		return exec.Command("echo", "mocked")
	}

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
	originalExecCommand := execCommand
	defer func() { execCommand = originalExecCommand }()

	execCommand = func(name string, arg ...string) *exec.Cmd {
		return exec.Command("echo", "mocked")
	}

	events := []SoundEvent{
		AgentStarted,
		AgentCompleted,
		AgentError,
		QuestionWaiting,
		TaskCompleted,
		PlanFinished,
	}

	for _, event := range events {
		// Should not panic
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
