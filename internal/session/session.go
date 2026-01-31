package session

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

type Session struct {
	ID              string
	Slug            string
	ProjectID       string
	ProjectWorktree string
	Directory       string
	Title           string
	Created         time.Time
	Updated         time.Time
}

type sessionJSON struct {
	ID        string `json:"id"`
	Slug      string `json:"slug"`
	ProjectID string `json:"projectID"`
	Directory string `json:"directory"`
	Title     string `json:"title"`
	Time      struct {
		Created int64 `json:"created"`
		Updated int64 `json:"updated"`
	} `json:"time"`
}

func getStoragePath() string {
	if xdgDataHome := os.Getenv("XDG_DATA_HOME"); xdgDataHome != "" {
		return xdgDataHome
	}

	home, err := os.UserHomeDir()
	if err != nil || home == "" {
		log.Printf("Warning: UserHomeDir failed, using temp dir: %v", err)
		return filepath.Join(os.TempDir(), "ocwatch")
	}

	return filepath.Join(home, ".local", "share")
}

func ListSessions(projectID string) ([]Session, error) {
	return ListSessionsWithPath(getStoragePath(), projectID)
}

func ListSessionsWithPath(storagePath, projectID string) ([]Session, error) {
	sessionDir := filepath.Join(storagePath, "opencode", "storage", "session", projectID)

	entries, err := os.ReadDir(sessionDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read session directory: %w", err)
	}

	var sessions []Session
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		sessionID := entry.Name()[:len(entry.Name())-5]
		session, err := GetSessionWithPath(storagePath, projectID, sessionID)
		if err != nil {
			continue
		}

		sessions = append(sessions, session)
	}

	return sessions, nil
}

func GetSession(projectID, sessionID string) (Session, error) {
	return GetSessionWithPath(getStoragePath(), projectID, sessionID)
}

func GetSessionWithPath(storagePath, projectID, sessionID string) (Session, error) {
	filePath := filepath.Join(storagePath, "opencode", "storage", "session", projectID, sessionID+".json")

	data, err := os.ReadFile(filePath)
	if err != nil {
		return Session{}, fmt.Errorf("failed to read session file: %w", err)
	}

	var sj sessionJSON
	if err := json.Unmarshal(data, &sj); err != nil {
		return Session{}, fmt.Errorf("failed to parse session JSON: %w", err)
	}

	return Session{
		ID:        sj.ID,
		Slug:      sj.Slug,
		ProjectID: sj.ProjectID,
		Directory: sj.Directory,
		Title:     sj.Title,
		Created:   time.UnixMilli(sj.Time.Created),
		Updated:   time.UnixMilli(sj.Time.Updated),
	}, nil
}

func FilterActiveSessions(sessions []Session, withinMinutes int) []Session {
	if withinMinutes == 0 {
		return sessions
	}

	cutoff := time.Now().Add(-time.Duration(withinMinutes) * time.Minute)
	var filtered []Session

	for _, s := range sessions {
		if s.Updated.After(cutoff) {
			filtered = append(filtered, s)
		}
	}

	return filtered
}

func FilterSessionsByToday(sessions []Session) []Session {
	midnight := time.Now().Truncate(24 * time.Hour)
	var filtered []Session

	for _, s := range sessions {
		if s.Updated.After(midnight) || s.Updated.Equal(midnight) {
			filtered = append(filtered, s)
		}
	}

	return filtered
}
