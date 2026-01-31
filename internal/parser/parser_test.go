package parser

import (
	"testing"
	"time"
)

func TestParseLine_ValidLLMEntry(t *testing.T) {
	line := "INFO  2026-01-31T10:05:40 +1ms service=llm providerID=anthropic modelID=claude-opus-4-5 sessionID=ses_xxx agent=prometheus mode=all stream"

	entry, err := ParseLine(line)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if entry == nil {
		t.Fatal("expected non-nil entry")
	}

	// Verify timestamp
	expectedTime, _ := time.Parse(time.RFC3339, "2026-01-31T10:05:40Z")
	if !entry.Timestamp.Equal(expectedTime) {
		t.Errorf("timestamp mismatch: got %v, want %v", entry.Timestamp, expectedTime)
	}

	// Verify fields
	if entry.Service != "llm" {
		t.Errorf("service mismatch: got %q, want %q", entry.Service, "llm")
	}
	if entry.ProviderID != "anthropic" {
		t.Errorf("providerID mismatch: got %q, want %q", entry.ProviderID, "anthropic")
	}
	if entry.ModelID != "claude-opus-4-5" {
		t.Errorf("modelID mismatch: got %q, want %q", entry.ModelID, "claude-opus-4-5")
	}
	if entry.SessionID != "ses_xxx" {
		t.Errorf("sessionID mismatch: got %q, want %q", entry.SessionID, "ses_xxx")
	}
	if entry.Agent != "prometheus" {
		t.Errorf("agent mismatch: got %q, want %q", entry.Agent, "prometheus")
	}
	if entry.Mode != "all" {
		t.Errorf("mode mismatch: got %q, want %q", entry.Mode, "all")
	}
}

func TestParseLine_ValidSessionEntry(t *testing.T) {
	line := "INFO  2026-01-31T10:05:26 +2ms service=session id=ses_xxx slug=hidden-meadow projectID=xxx directory=/path title=\"New session created\""

	entry, err := ParseLine(line)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if entry == nil {
		t.Fatal("expected non-nil entry")
	}

	// Verify timestamp
	expectedTime, _ := time.Parse(time.RFC3339, "2026-01-31T10:05:26Z")
	if !entry.Timestamp.Equal(expectedTime) {
		t.Errorf("timestamp mismatch: got %v, want %v", entry.Timestamp, expectedTime)
	}

	// Verify service field
	if entry.Service != "session" {
		t.Errorf("service mismatch: got %q, want %q", entry.Service, "session")
	}

	// SessionID should be extracted from 'id' field
	if entry.SessionID != "ses_xxx" {
		t.Errorf("sessionID mismatch: got %q, want %q", entry.SessionID, "ses_xxx")
	}
}

func TestParseLine_MalformedLine(t *testing.T) {
	line := "this is not a valid log line"

	entry, err := ParseLine(line)

	if err == nil {
		t.Fatal("expected error for malformed line")
	}

	if entry != nil {
		t.Fatal("expected nil entry for malformed line")
	}
}

func TestParseLine_EmptyLine(t *testing.T) {
	line := ""

	entry, err := ParseLine(line)

	if err == nil {
		t.Fatal("expected error for empty line")
	}

	if entry != nil {
		t.Fatal("expected nil entry for empty line")
	}
}

func TestParseLine_DifferentLogLevels(t *testing.T) {
	tests := []struct {
		name     string
		line     string
		wantErr  bool
		wantTime string
	}{
		{
			name:     "ERROR level",
			line:     "ERROR 2026-01-31T10:05:40 +1ms service=llm providerID=anthropic modelID=claude-opus-4-5 sessionID=ses_xxx agent=prometheus mode=all",
			wantErr:  false,
			wantTime: "2026-01-31T10:05:40Z",
		},
		{
			name:     "WARN level",
			line:     "WARN  2026-01-31T10:05:40 +1ms service=llm providerID=anthropic modelID=claude-opus-4-5 sessionID=ses_xxx agent=prometheus mode=all",
			wantErr:  false,
			wantTime: "2026-01-31T10:05:40Z",
		},
		{
			name:     "DEBUG level",
			line:     "DEBUG 2026-01-31T10:05:40 +1ms service=llm providerID=anthropic modelID=claude-opus-4-5 sessionID=ses_xxx agent=prometheus mode=all",
			wantErr:  false,
			wantTime: "2026-01-31T10:05:40Z",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entry, err := ParseLine(tt.line)

			if (err != nil) != tt.wantErr {
				t.Errorf("ParseLine() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && entry == nil {
				t.Fatal("expected non-nil entry")
			}

			if !tt.wantErr {
				expectedTime, _ := time.Parse(time.RFC3339, tt.wantTime)
				if !entry.Timestamp.Equal(expectedTime) {
					t.Errorf("timestamp mismatch: got %v, want %v", entry.Timestamp, expectedTime)
				}
			}
		})
	}
}

func TestParseLine_TimestampWithZ(t *testing.T) {
	line := "INFO 2026-01-31T10:05:40Z +1ms service=test"

	entry, err := ParseLine(line)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if entry == nil {
		t.Fatal("expected non-nil entry")
	}

	// Verify timestamp parses correctly (should not have double Z)
	expectedTime, _ := time.Parse(time.RFC3339, "2026-01-31T10:05:40Z")
	if !entry.Timestamp.Equal(expectedTime) {
		t.Errorf("timestamp mismatch: got %v, want %v", entry.Timestamp, expectedTime)
	}

	if entry.Service != "test" {
		t.Errorf("service mismatch: got %q, want %q", entry.Service, "test")
	}
}
