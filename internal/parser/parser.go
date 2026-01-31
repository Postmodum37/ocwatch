package parser

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// LogEntry represents a parsed log line from OpenCode
type LogEntry struct {
	Timestamp  time.Time
	Service    string
	ProviderID string
	ModelID    string
	SessionID  string
	Agent      string
	Mode       string
}

// ParseLine parses a single log line and extracts fields
// Format: LEVEL TIMESTAMP +Xms key=value key=value ...
func ParseLine(line string) (*LogEntry, error) {
	if line == "" {
		return nil, fmt.Errorf("empty log line")
	}

	parts := strings.Fields(line)
	if len(parts) < 3 {
		return nil, fmt.Errorf("invalid log format: insufficient fields")
	}

	// Extract log level (INFO, ERROR, WARN, DEBUG)
	logLevel := parts[0]
	if !isValidLogLevel(logLevel) {
		return nil, fmt.Errorf("invalid log level: %s", logLevel)
	}

	// Extract timestamp (RFC3339 format)
	timestampStr := parts[1]
	if !strings.HasSuffix(timestampStr, "Z") {
		timestampStr += "Z"
	}
	timestamp, err := time.Parse(time.RFC3339, timestampStr)
	if err != nil {
		return nil, fmt.Errorf("invalid timestamp: %s", timestampStr)
	}

	// Skip the +Xms field (parts[2])

	// Parse key=value pairs
	kvPairs := make(map[string]string)
	for i := 3; i < len(parts); i++ {
		part := parts[i]

		// Handle quoted values
		if strings.Contains(part, "=") {
			key, value := parseKeyValue(part)
			if key != "" {
				kvPairs[key] = value
			}
		}
	}

	// Extract fields from key-value pairs
	entry := &LogEntry{
		Timestamp:  timestamp,
		Service:    kvPairs["service"],
		ProviderID: kvPairs["providerID"],
		ModelID:    kvPairs["modelID"],
		SessionID:  kvPairs["sessionID"],
		Agent:      kvPairs["agent"],
		Mode:       kvPairs["mode"],
	}

	// Handle 'id' field as sessionID for session service
	if entry.SessionID == "" && kvPairs["id"] != "" {
		entry.SessionID = kvPairs["id"]
	}

	// Validate that we have at least a service
	if entry.Service == "" {
		return nil, fmt.Errorf("missing required field: service")
	}

	return entry, nil
}

func isValidLogLevel(level string) bool {
	validLevels := map[string]bool{
		"INFO":  true,
		"ERROR": true,
		"WARN":  true,
		"DEBUG": true,
	}
	return validLevels[level]
}

// parseKeyValue extracts a key and its value from a "key=value" or "key=\"value\"" string.
// It handles quoted values that may contain spaces or other special characters.
func parseKeyValue(part string) (string, string) {
	// Handle quoted values like title="New session created"
	if strings.Contains(part, "=\"") {
		// Regex to extract key and everything inside quotes
		re := regexp.MustCompile(`^(\w+)="([^"]*)"`)
		matches := re.FindStringSubmatch(part)
		if len(matches) == 3 {
			return matches[1], matches[2]
		}
	}

	// Handle simple key=value pairs
	if idx := strings.Index(part, "="); idx != -1 {
		key := part[:idx]
		value := part[idx+1:]
		return key, value
	}

	return "", ""
}
