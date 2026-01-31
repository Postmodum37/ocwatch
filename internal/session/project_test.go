package session

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestListAllProjects_ReturnsMultipleProjects(t *testing.T) {
	// Setup: Create temporary directory structure
	tmpDir := t.TempDir()
	projectDir := filepath.Join(tmpDir, "storage", "project")
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		t.Fatalf("failed to create project directory: %v", err)
	}

	// Create test project files
	projects := []struct {
		id       string
		worktree string
		created  int64
		updated  int64
	}{
		{"proj1", "/home/user/project1", 1000, 3000},
		{"proj2", "/home/user/project2", 2000, 2000},
		{"proj3", "/home/user/project3", 3000, 1000},
	}

	for _, p := range projects {
		data := map[string]interface{}{
			"id":       p.id,
			"worktree": p.worktree,
			"vcs":      "git",
			"time": map[string]int64{
				"created": p.created,
				"updated": p.updated,
			},
		}
		jsonData, _ := json.Marshal(data)
		filePath := filepath.Join(projectDir, p.id+".json")
		if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
			t.Fatalf("failed to write project file: %v", err)
		}
	}

	// Execute
	result, err := ListAllProjects(tmpDir)

	// Verify
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(result) != 3 {
		t.Fatalf("expected 3 projects, got %d", len(result))
	}

	// Verify sorted by Updated desc (proj1=3000, proj2=2000, proj3=1000)
	if result[0].ID != "proj1" {
		t.Errorf("expected first project to be proj1, got %s", result[0].ID)
	}
	if result[1].ID != "proj2" {
		t.Errorf("expected second project to be proj2, got %s", result[1].ID)
	}
	if result[2].ID != "proj3" {
		t.Errorf("expected third project to be proj3, got %s", result[2].ID)
	}

	// Verify worktree field
	if result[0].Worktree != "/home/user/project1" {
		t.Errorf("expected worktree /home/user/project1, got %s", result[0].Worktree)
	}
}

func TestListAllProjects_ExcludesGlobalProject(t *testing.T) {
	// Setup: Create temporary directory structure
	tmpDir := t.TempDir()
	projectDir := filepath.Join(tmpDir, "storage", "project")
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		t.Fatalf("failed to create project directory: %v", err)
	}

	// Create global.json with worktree="/"
	globalData := map[string]interface{}{
		"id":       "global",
		"worktree": "/",
		"vcs":      "git",
		"time": map[string]int64{
			"created": 1000,
			"updated": 2000,
		},
	}
	globalJSON, _ := json.Marshal(globalData)
	globalPath := filepath.Join(projectDir, "global.json")
	if err := os.WriteFile(globalPath, globalJSON, 0644); err != nil {
		t.Fatalf("failed to write global.json: %v", err)
	}

	// Create regular project
	projectData := map[string]interface{}{
		"id":       "proj1",
		"worktree": "/home/user/project1",
		"vcs":      "git",
		"time": map[string]int64{
			"created": 1000,
			"updated": 3000,
		},
	}
	projectJSON, _ := json.Marshal(projectData)
	projectPath := filepath.Join(projectDir, "proj1.json")
	if err := os.WriteFile(projectPath, projectJSON, 0644); err != nil {
		t.Fatalf("failed to write proj1.json: %v", err)
	}

	// Execute
	result, err := ListAllProjects(tmpDir)

	// Verify
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 project (global excluded), got %d", len(result))
	}

	if result[0].ID != "proj1" {
		t.Errorf("expected project to be proj1, got %s", result[0].ID)
	}
}

func TestListAllProjects_HandlesEmptyDirectory(t *testing.T) {
	// Setup: Create temporary directory structure with no projects
	tmpDir := t.TempDir()
	projectDir := filepath.Join(tmpDir, "storage", "project")
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		t.Fatalf("failed to create project directory: %v", err)
	}

	// Execute
	result, err := ListAllProjects(tmpDir)

	// Verify
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(result) != 0 {
		t.Fatalf("expected 0 projects, got %d", len(result))
	}
}

func TestListAllSessions_ReturnsSessionsFromMultipleProjects(t *testing.T) {
	// Setup: Create temporary directory structure
	tmpDir := t.TempDir()
	projectDir := filepath.Join(tmpDir, "storage", "project")
	sessionDir := filepath.Join(tmpDir, "storage", "session")
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		t.Fatalf("failed to create project directory: %v", err)
	}

	// Create two projects
	projects := []struct {
		id       string
		worktree string
	}{
		{"proj1", "/home/user/project1"},
		{"proj2", "/home/user/project2"},
	}

	for _, p := range projects {
		data := map[string]interface{}{
			"id":       p.id,
			"worktree": p.worktree,
			"vcs":      "git",
			"time": map[string]int64{
				"created": 1000,
				"updated": 2000,
			},
		}
		jsonData, _ := json.Marshal(data)
		filePath := filepath.Join(projectDir, p.id+".json")
		if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
			t.Fatalf("failed to write project file: %v", err)
		}

		// Create session directory for each project
		projSessionDir := filepath.Join(sessionDir, p.id)
		if err := os.MkdirAll(projSessionDir, 0755); err != nil {
			t.Fatalf("failed to create session directory: %v", err)
		}
	}

	// Create sessions for proj1
	sessions1 := []struct {
		id      string
		title   string
		updated int64
	}{
		{"ses1", "Session 1", 5000},
		{"ses2", "Session 2", 4000},
	}

	for _, s := range sessions1 {
		data := map[string]interface{}{
			"id":        s.id,
			"slug":      s.id,
			"projectID": "proj1",
			"directory": "/home/user/project1",
			"title":     s.title,
			"time": map[string]int64{
				"created": 1000,
				"updated": s.updated,
			},
		}
		jsonData, _ := json.Marshal(data)
		filePath := filepath.Join(sessionDir, "proj1", s.id+".json")
		if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
			t.Fatalf("failed to write session file: %v", err)
		}
	}

	// Create sessions for proj2
	sessions2 := []struct {
		id      string
		title   string
		updated int64
	}{
		{"ses3", "Session 3", 6000},
	}

	for _, s := range sessions2 {
		data := map[string]interface{}{
			"id":        s.id,
			"slug":      s.id,
			"projectID": "proj2",
			"directory": "/home/user/project2",
			"title":     s.title,
			"time": map[string]int64{
				"created": 1000,
				"updated": s.updated,
			},
		}
		jsonData, _ := json.Marshal(data)
		filePath := filepath.Join(sessionDir, "proj2", s.id+".json")
		if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
			t.Fatalf("failed to write session file: %v", err)
		}
	}

	// Execute
	result, err := ListAllSessions(tmpDir)

	// Verify
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(result) != 3 {
		t.Fatalf("expected 3 sessions total, got %d", len(result))
	}

	// Verify sorted by Updated desc (ses3=6000, ses1=5000, ses2=4000)
	if result[0].ID != "ses3" {
		t.Errorf("expected first session to be ses3, got %s", result[0].ID)
	}
	if result[1].ID != "ses1" {
		t.Errorf("expected second session to be ses1, got %s", result[1].ID)
	}
	if result[2].ID != "ses2" {
		t.Errorf("expected third session to be ses2, got %s", result[2].ID)
	}
}

func TestListAllSessions_IncludesProjectInfo(t *testing.T) {
	// Setup: Create temporary directory structure
	tmpDir := t.TempDir()
	projectDir := filepath.Join(tmpDir, "storage", "project")
	sessionDir := filepath.Join(tmpDir, "storage", "session")
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		t.Fatalf("failed to create project directory: %v", err)
	}

	// Create project
	projectData := map[string]interface{}{
		"id":       "proj1",
		"worktree": "/home/user/myproject",
		"vcs":      "git",
		"time": map[string]int64{
			"created": 1000,
			"updated": 2000,
		},
	}
	projectJSON, _ := json.Marshal(projectData)
	projectPath := filepath.Join(projectDir, "proj1.json")
	if err := os.WriteFile(projectPath, projectJSON, 0644); err != nil {
		t.Fatalf("failed to write project file: %v", err)
	}

	// Create session directory
	projSessionDir := filepath.Join(sessionDir, "proj1")
	if err := os.MkdirAll(projSessionDir, 0755); err != nil {
		t.Fatalf("failed to create session directory: %v", err)
	}

	// Create session
	sessionData := map[string]interface{}{
		"id":        "ses1",
		"slug":      "ses1",
		"projectID": "proj1",
		"directory": "/home/user/myproject",
		"title":     "Test Session",
		"time": map[string]int64{
			"created": 1000,
			"updated": 3000,
		},
	}
	sessionJSON, _ := json.Marshal(sessionData)
	sessionPath := filepath.Join(sessionDir, "proj1", "ses1.json")
	if err := os.WriteFile(sessionPath, sessionJSON, 0644); err != nil {
		t.Fatalf("failed to write session file: %v", err)
	}

	// Execute
	result, err := ListAllSessions(tmpDir)

	// Verify
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 session, got %d", len(result))
	}

	// Verify ProjectWorktree field is populated
	if result[0].ProjectWorktree != "/home/user/myproject" {
		t.Errorf("expected ProjectWorktree to be /home/user/myproject, got %s", result[0].ProjectWorktree)
	}

	// Verify other session fields
	if result[0].ID != "ses1" {
		t.Errorf("expected session ID to be ses1, got %s", result[0].ID)
	}
	if result[0].ProjectID != "proj1" {
		t.Errorf("expected ProjectID to be proj1, got %s", result[0].ProjectID)
	}
}
