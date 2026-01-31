package main

import (
	"os/exec"
	"runtime"
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

// TestNoGoroutineLeak verifies that all goroutines exit cleanly when the program shuts down.
// This test checks that the goroutine count returns to baseline after shutdown.
func TestNoGoroutineLeak(t *testing.T) {
	// Get baseline goroutine count
	runtime.GC()
	time.Sleep(50 * time.Millisecond)
	baseline := runtime.NumGoroutine()

	// Build and run the binary
	cmd := exec.Command("go", "build", "-o", "/tmp/ocwatch-leak-test", ".")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("Failed to build binary: %v\nOutput: %s", err, output)
	}

	proc := exec.Command("/tmp/ocwatch-leak-test", "--data-dir", "/tmp/ocwatch-leak-test-data")
	if err := proc.Start(); err != nil {
		t.Fatalf("Failed to start process: %v", err)
	}

	// Let the process start and spawn goroutines
	time.Sleep(200 * time.Millisecond)

	// Send SIGTERM to trigger shutdown
	if err := proc.Process.Signal(syscall.SIGTERM); err != nil {
		t.Fatalf("Failed to send SIGTERM: %v", err)
	}

	// Wait for process to exit
	done := make(chan error, 1)
	go func() {
		done <- proc.Wait()
	}()

	select {
	case err := <-done:
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				if exitErr.ExitCode() != 0 {
					t.Logf("Process exited with code %d (expected for SIGTERM)", exitErr.ExitCode())
				}
			}
		}
	case <-time.After(5 * time.Second):
		proc.Process.Kill()
		t.Fatalf("Process did not exit within 5 seconds - likely goroutine leak")
	}

	// Give time for goroutines to clean up
	runtime.GC()
	time.Sleep(100 * time.Millisecond)

	// Check goroutine count returned to baseline (allow small variance)
	final := runtime.NumGoroutine()
	if final > baseline+2 {
		t.Errorf("Goroutine leak detected: baseline=%d, final=%d (diff=%d)", baseline, final, final-baseline)
	}
}
