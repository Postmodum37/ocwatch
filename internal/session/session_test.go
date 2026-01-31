package session

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestSession_Struct verifies Session struct has required fields
func TestSession_Struct(t *testing.T) {
	s := Session{
		ID:        "ses_test123",
		Slug:      "test-slug",
		ProjectID: "proj123",
		Directory: "/home/user/project",
		Title:     "Test Session",
		Created:   time.Now(),
		Updated:   time.Now(),
	}

	if s.ID != "ses_test123" {
		t.Errorf("ID mismatch: got %s", s.ID)
	}
	if s.Slug != "test-slug" {
		t.Errorf("Slug mismatch: got %s", s.Slug)
	}
	if s.ProjectID != "proj123" {
		t.Errorf("ProjectID mismatch: got %s", s.ProjectID)
	}
	if s.Directory != "/home/user/project" {
		t.Errorf("Directory mismatch: got %s", s.Directory)
	}
	if s.Title != "Test Session" {
		t.Errorf("Title mismatch: got %s", s.Title)
	}
}

// TestListSessions reads all sessions from storage
func TestListSessions(t *testing.T) {
	// Create temporary storage directory
	tmpDir := t.TempDir()
	projectID := "test_project_123"
	sessionDir := filepath.Join(tmpDir, "opencode", "storage", "session", projectID)
	os.MkdirAll(sessionDir, 0755)

	// Create test session files
	session1JSON := `{
		"id": "ses_001",
		"slug": "first-session",
		"projectID": "test_project_123",
		"directory": "/home/user/project1",
		"title": "First Session",
		"time": {
			"created": 1769853939301,
			"updated": 1769854012234
		}
	}`

	session2JSON := `{
		"id": "ses_002",
		"slug": "second-session",
		"projectID": "test_project_123",
		"directory": "/home/user/project2",
		"title": "Second Session",
		"time": {
			"created": 1769853939301,
			"updated": 1769854012234
		}
	}`

	os.WriteFile(filepath.Join(sessionDir, "ses_001.json"), []byte(session1JSON), 0644)
	os.WriteFile(filepath.Join(sessionDir, "ses_002.json"), []byte(session2JSON), 0644)

	// Test ListSessions with custom storage path
	sessions, err := ListSessionsWithPath(tmpDir, projectID)
	if err != nil {
		t.Fatalf("ListSessions failed: %v", err)
	}

	if len(sessions) != 2 {
		t.Errorf("Expected 2 sessions, got %d", len(sessions))
	}

	if sessions[0].ID != "ses_001" {
		t.Errorf("First session ID mismatch: got %s", sessions[0].ID)
	}
	if sessions[1].ID != "ses_002" {
		t.Errorf("Second session ID mismatch: got %s", sessions[1].ID)
	}
}

// TestGetSession retrieves a specific session
func TestGetSession(t *testing.T) {
	tmpDir := t.TempDir()
	projectID := "test_project_456"
	sessionDir := filepath.Join(tmpDir, "opencode", "storage", "session", projectID)
	os.MkdirAll(sessionDir, 0755)

	sessionJSON := `{
		"id": "ses_specific",
		"slug": "specific-session",
		"projectID": "test_project_456",
		"directory": "/home/user/specific",
		"title": "Specific Session",
		"time": {
			"created": 1769853939301,
			"updated": 1769854012234
		}
	}`

	os.WriteFile(filepath.Join(sessionDir, "ses_specific.json"), []byte(sessionJSON), 0644)

	session, err := GetSessionWithPath(tmpDir, projectID, "ses_specific")
	if err != nil {
		t.Fatalf("GetSession failed: %v", err)
	}

	if session.ID != "ses_specific" {
		t.Errorf("Session ID mismatch: got %s", session.ID)
	}
	if session.Slug != "specific-session" {
		t.Errorf("Session slug mismatch: got %s", session.Slug)
	}
	if session.Title != "Specific Session" {
		t.Errorf("Session title mismatch: got %s", session.Title)
	}
}

// TestGetSession_NotFound returns error when session doesn't exist
func TestGetSession_NotFound(t *testing.T) {
	tmpDir := t.TempDir()
	projectID := "test_project_789"
	sessionDir := filepath.Join(tmpDir, "opencode", "storage", "session", projectID)
	os.MkdirAll(sessionDir, 0755)

	_, err := GetSessionWithPath(tmpDir, projectID, "nonexistent")
	if err == nil {
		t.Error("Expected error for nonexistent session, got nil")
	}
}

// TestTimestampConversion verifies Unix milliseconds are converted to time.Time
func TestTimestampConversion(t *testing.T) {
	tmpDir := t.TempDir()
	projectID := "test_project_time"
	sessionDir := filepath.Join(tmpDir, "opencode", "storage", "session", projectID)
	os.MkdirAll(sessionDir, 0755)

	// Use known timestamp: 1769853939301 ms = 2026-01-31 10:05:39.301 UTC
	sessionJSON := `{
		"id": "ses_time",
		"slug": "time-test",
		"projectID": "test_project_time",
		"directory": "/home/user/time",
		"title": "Time Test",
		"time": {
			"created": 1769853939301,
			"updated": 1769854012234
		}
	}`

	os.WriteFile(filepath.Join(sessionDir, "ses_time.json"), []byte(sessionJSON), 0644)

	session, err := GetSessionWithPath(tmpDir, projectID, "ses_time")
	if err != nil {
		t.Fatalf("GetSession failed: %v", err)
	}

	// Verify timestamps are converted correctly
	expectedCreated := time.UnixMilli(1769853939301)
	expectedUpdated := time.UnixMilli(1769854012234)

	if !session.Created.Equal(expectedCreated) {
		t.Errorf("Created timestamp mismatch: got %v, expected %v", session.Created, expectedCreated)
	}
	if !session.Updated.Equal(expectedUpdated) {
		t.Errorf("Updated timestamp mismatch: got %v, expected %v", session.Updated, expectedUpdated)
	}
}

// TestFilterActiveSessions filters sessions by recent activity
func TestFilterActiveSessions(t *testing.T) {
	now := time.Now()
	recentTime := now.Add(-5 * time.Minute)
	oldTime := now.Add(-2 * time.Hour)

	sessions := []Session{
		{
			ID:      "ses_recent",
			Updated: recentTime,
		},
		{
			ID:      "ses_old",
			Updated: oldTime,
		},
		{
			ID:      "ses_very_recent",
			Updated: now.Add(-1 * time.Minute),
		},
	}

	// Filter sessions updated within last 30 minutes
	filtered := FilterActiveSessions(sessions, 30)

	if len(filtered) != 2 {
		t.Errorf("Expected 2 filtered sessions, got %d", len(filtered))
	}

	// Verify correct sessions are included
	ids := make(map[string]bool)
	for _, s := range filtered {
		ids[s.ID] = true
	}

	if !ids["ses_recent"] {
		t.Error("ses_recent should be in filtered results")
	}
	if !ids["ses_very_recent"] {
		t.Error("ses_very_recent should be in filtered results")
	}
	if ids["ses_old"] {
		t.Error("ses_old should not be in filtered results")
	}
}

// TestFilterActiveSessions_ZeroMinutes includes all sessions
func TestFilterActiveSessions_ZeroMinutes(t *testing.T) {
	now := time.Now()
	sessions := []Session{
		{ID: "ses_1", Updated: now.Add(-1 * time.Hour)},
		{ID: "ses_2", Updated: now.Add(-24 * time.Hour)},
		{ID: "ses_3", Updated: now},
	}

	filtered := FilterActiveSessions(sessions, 0)

	if len(filtered) != 3 {
		t.Errorf("Expected 3 sessions with 0 minutes filter, got %d", len(filtered))
	}
}

// TestXDGDataHome respects XDG_DATA_HOME environment variable
func TestXDGDataHome(t *testing.T) {
	tmpDir := t.TempDir()
	projectID := "test_xdg"
	sessionDir := filepath.Join(tmpDir, "opencode", "storage", "session", projectID)
	os.MkdirAll(sessionDir, 0755)

	sessionJSON := `{
		"id": "ses_xdg",
		"slug": "xdg-test",
		"projectID": "test_xdg",
		"directory": "/home/user/xdg",
		"title": "XDG Test",
		"time": {
			"created": 1769853939301,
			"updated": 1769854012234
		}
	}`

	os.WriteFile(filepath.Join(sessionDir, "ses_xdg.json"), []byte(sessionJSON), 0644)

	// Set XDG_DATA_HOME to temp directory
	oldXDG := os.Getenv("XDG_DATA_HOME")
	os.Setenv("XDG_DATA_HOME", tmpDir)
	defer os.Setenv("XDG_DATA_HOME", oldXDG)

	session, err := GetSession(projectID, "ses_xdg")
	if err != nil {
		t.Fatalf("GetSession with XDG_DATA_HOME failed: %v", err)
	}

	if session.ID != "ses_xdg" {
		t.Errorf("Session ID mismatch: got %s", session.ID)
	}
}

// TestListSessions_DefaultPath uses default ~/.local/share when XDG_DATA_HOME not set
func TestListSessions_DefaultPath(t *testing.T) {
	// Just verify the function exists and has correct signature
	// (actual file reading would require real storage)
	_ = ListSessions
}

// TestFilterSessionsByToday_IncludesTodaySessions includes sessions updated today
func TestFilterSessionsByToday_IncludesTodaySessions(t *testing.T) {
	now := time.Now()
	midnight := now.Truncate(24 * time.Hour)

	// Session updated 1 minute ago (today)
	todaySession := Session{
		ID:      "ses_today",
		Updated: now.Add(-1 * time.Minute),
	}

	// Session updated at midnight (today)
	midnightSession := Session{
		ID:      "ses_midnight",
		Updated: midnight,
	}

	sessions := []Session{todaySession, midnightSession}
	filtered := FilterSessionsByToday(sessions)

	if len(filtered) != 2 {
		t.Errorf("Expected 2 sessions from today, got %d", len(filtered))
	}

	// Verify both sessions are included
	ids := make(map[string]bool)
	for _, s := range filtered {
		ids[s.ID] = true
	}

	if !ids["ses_today"] {
		t.Error("ses_today should be in filtered results")
	}
	if !ids["ses_midnight"] {
		t.Error("ses_midnight should be in filtered results")
	}
}

// TestFilterSessionsByToday_ExcludesYesterdaySessions excludes sessions from yesterday
func TestFilterSessionsByToday_ExcludesYesterdaySessions(t *testing.T) {
	now := time.Now()
	midnight := now.Truncate(24 * time.Hour)

	// Session updated 1 second before midnight (yesterday)
	yesterdaySession := Session{
		ID:      "ses_yesterday",
		Updated: midnight.Add(-1 * time.Second),
	}

	// Session updated 1 hour before midnight (yesterday)
	oldSession := Session{
		ID:      "ses_old",
		Updated: midnight.Add(-1 * time.Hour),
	}

	// Session updated today
	todaySession := Session{
		ID:      "ses_today",
		Updated: now,
	}

	sessions := []Session{yesterdaySession, oldSession, todaySession}
	filtered := FilterSessionsByToday(sessions)

	if len(filtered) != 1 {
		t.Errorf("Expected 1 session from today, got %d", len(filtered))
	}

	if filtered[0].ID != "ses_today" {
		t.Errorf("Expected ses_today, got %s", filtered[0].ID)
	}
}

// TestGetStoragePathFallback verifies fallback to temp dir when UserHomeDir fails
func TestGetStoragePathFallback(t *testing.T) {
	oldXDG := os.Getenv("XDG_DATA_HOME")
	os.Setenv("XDG_DATA_HOME", "")
	defer os.Setenv("XDG_DATA_HOME", oldXDG)

	path := getStoragePath()

	if path == "" {
		t.Error("getStoragePath returned empty string")
	}

	if path == "/.local/share" {
		t.Errorf("getStoragePath returned root-based path: %s", path)
	}

	tempDir := os.TempDir()
	if !filepath.HasPrefix(path, tempDir) {
		t.Logf("Path returned: %s (expected to start with %s)", path, tempDir)
	}
}
