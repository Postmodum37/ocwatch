package main

import (
	"os/exec"
	"syscall"
	"testing"
	"time"
)

// TestShutdownNoDoublePanic verifies that sending SIGTERM doesn't cause a panic
// from double-closing quitChan. This test runs the binary as a subprocess.
func TestShutdownNoDoublePanic(t *testing.T) {
	cmd := exec.Command("go", "build", "-o", "/tmp/ocwatch-test", ".")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("Failed to build binary: %v\nOutput: %s", err, output)
	}

	proc := exec.Command("/tmp/ocwatch-test", "--data-dir", "/tmp/ocwatch-test-data")
	if err := proc.Start(); err != nil {
		t.Fatalf("Failed to start process: %v", err)
	}

	time.Sleep(100 * time.Millisecond)

	if err := proc.Process.Signal(syscall.SIGTERM); err != nil {
		t.Fatalf("Failed to send SIGTERM: %v", err)
	}

	done := make(chan error, 1)
	go func() {
		done <- proc.Wait()
	}()

	select {
	case err := <-done:
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				if exitErr.ExitCode() == 2 {
					t.Fatalf("Process exited with panic (code 2)")
				}
			}
		}
	case <-time.After(5 * time.Second):
		proc.Process.Kill()
		t.Fatalf("Process did not exit within 5 seconds")
	}
}
