package plan

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReadBoulder_ValidFile(t *testing.T) {
	// Create temp directory
	tmpDir := t.TempDir()

	// Create .sisyphus directory
	sisyphusDir := filepath.Join(tmpDir, ".sisyphus")
	if err := os.MkdirAll(sisyphusDir, 0755); err != nil {
		t.Fatalf("Failed to create .sisyphus dir: %v", err)
	}

	// Create boulder.json
	boulderPath := filepath.Join(sisyphusDir, "boulder.json")
	boulderContent := `{
  "active_plan": ".sisyphus/plans/test.md",
  "session_ids": ["ses_123", "ses_456"],
  "status": "in_progress",
  "started_at": "2026-01-31T10:33:13.126Z"
}`
	if err := os.WriteFile(boulderPath, []byte(boulderContent), 0644); err != nil {
		t.Fatalf("Failed to write boulder.json: %v", err)
	}

	// Test ReadBoulder
	boulder, err := ReadBoulder(tmpDir)
	if err != nil {
		t.Fatalf("ReadBoulder failed: %v", err)
	}

	if boulder.ActivePlan != ".sisyphus/plans/test.md" {
		t.Errorf("Expected ActivePlan '.sisyphus/plans/test.md', got '%s'", boulder.ActivePlan)
	}

	if boulder.Status != "in_progress" {
		t.Errorf("Expected Status 'in_progress', got '%s'", boulder.Status)
	}

	if len(boulder.SessionIDs) != 2 {
		t.Errorf("Expected 2 session IDs, got %d", len(boulder.SessionIDs))
	}

	if boulder.SessionIDs[0] != "ses_123" {
		t.Errorf("Expected first session 'ses_123', got '%s'", boulder.SessionIDs[0])
	}
}

func TestReadBoulder_MissingFile(t *testing.T) {
	tmpDir := t.TempDir()

	boulder, err := ReadBoulder(tmpDir)
	if err == nil {
		t.Fatal("Expected error for missing boulder.json, got nil")
	}

	if boulder != nil {
		t.Errorf("Expected nil boulder, got %v", boulder)
	}
}

func TestReadPlan_ValidFile(t *testing.T) {
	tmpDir := t.TempDir()

	// Create plan markdown file
	planPath := filepath.Join(tmpDir, "test.md")
	planContent := `# Test Plan

- [x] Task 1 completed
- [ ] Task 2 incomplete
- [x] Task 3 completed
- [ ] Task 4 incomplete
- [ ] Task 5 incomplete
`
	if err := os.WriteFile(planPath, []byte(planContent), 0644); err != nil {
		t.Fatalf("Failed to write plan file: %v", err)
	}

	// Test ReadPlan
	plan, err := ReadPlan(planPath)
	if err != nil {
		t.Fatalf("ReadPlan failed: %v", err)
	}

	if plan.Completed != 2 {
		t.Errorf("Expected 2 completed tasks, got %d", plan.Completed)
	}

	if plan.Total != 5 {
		t.Errorf("Expected 5 total tasks, got %d", plan.Total)
	}

	expectedProgress := float64(2) / float64(5)
	if plan.Progress != expectedProgress {
		t.Errorf("Expected progress %.2f, got %.2f", expectedProgress, plan.Progress)
	}
}

func TestReadPlan_MissingFile(t *testing.T) {
	tmpDir := t.TempDir()
	planPath := filepath.Join(tmpDir, "nonexistent.md")

	plan, err := ReadPlan(planPath)
	if err == nil {
		t.Fatal("Expected error for missing plan file, got nil")
	}

	if plan != nil {
		t.Errorf("Expected nil plan, got %v", plan)
	}
}

func TestCalculateProgress_AllCompleted(t *testing.T) {
	content := `# Plan
- [x] Task 1
- [x] Task 2
- [x] Task 3
`
	completed, total := CalculateProgress(content)

	if completed != 3 {
		t.Errorf("Expected 3 completed, got %d", completed)
	}

	if total != 3 {
		t.Errorf("Expected 3 total, got %d", total)
	}
}

func TestCalculateProgress_NoneCompleted(t *testing.T) {
	content := `# Plan
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
`
	completed, total := CalculateProgress(content)

	if completed != 0 {
		t.Errorf("Expected 0 completed, got %d", completed)
	}

	if total != 3 {
		t.Errorf("Expected 3 total, got %d", total)
	}
}

func TestCalculateProgress_Mixed(t *testing.T) {
	content := `# Plan
- [x] Task 1
- [ ] Task 2
- [X] Task 3
- [ ] Task 4
`
	completed, total := CalculateProgress(content)

	if completed != 2 {
		t.Errorf("Expected 2 completed, got %d", completed)
	}

	if total != 4 {
		t.Errorf("Expected 4 total, got %d", total)
	}
}

func TestCalculateProgress_CaseInsensitive(t *testing.T) {
	content := `# Plan
- [x] Task 1
- [X] Task 2
- [ ] Task 3
`
	completed, total := CalculateProgress(content)

	if completed != 2 {
		t.Errorf("Expected 2 completed (both [x] and [X]), got %d", completed)
	}

	if total != 3 {
		t.Errorf("Expected 3 total, got %d", total)
	}
}

func TestCalculateProgress_NoCheckboxes(t *testing.T) {
	content := `# Plan
This is just text with no checkboxes.
`
	completed, total := CalculateProgress(content)

	if completed != 0 {
		t.Errorf("Expected 0 completed, got %d", completed)
	}

	if total != 0 {
		t.Errorf("Expected 0 total, got %d", total)
	}
}

func TestCalculateProgress_EmptyContent(t *testing.T) {
	content := ""
	completed, total := CalculateProgress(content)

	if completed != 0 {
		t.Errorf("Expected 0 completed, got %d", completed)
	}

	if total != 0 {
		t.Errorf("Expected 0 total, got %d", total)
	}
}

func TestReadBoulder_WithAbsolutePath(t *testing.T) {
	tmpDir := t.TempDir()

	// Create .sisyphus directory
	sisyphusDir := filepath.Join(tmpDir, ".sisyphus")
	if err := os.MkdirAll(sisyphusDir, 0755); err != nil {
		t.Fatalf("Failed to create .sisyphus dir: %v", err)
	}

	// Create plans directory
	plansDir := filepath.Join(sisyphusDir, "plans")
	if err := os.MkdirAll(plansDir, 0755); err != nil {
		t.Fatalf("Failed to create plans dir: %v", err)
	}

	// Create plan file
	planPath := filepath.Join(plansDir, "test.md")
	planContent := `# Test
- [x] Done
- [ ] Todo
`
	if err := os.WriteFile(planPath, []byte(planContent), 0644); err != nil {
		t.Fatalf("Failed to write plan file: %v", err)
	}

	// Create boulder.json with absolute path
	boulderPath := filepath.Join(sisyphusDir, "boulder.json")
	boulderContent := `{
  "active_plan": "` + planPath + `",
  "session_ids": ["ses_123"],
  "status": "in_progress"
}`
	if err := os.WriteFile(boulderPath, []byte(boulderContent), 0644); err != nil {
		t.Fatalf("Failed to write boulder.json: %v", err)
	}

	// Test ReadBoulder
	boulder, err := ReadBoulder(tmpDir)
	if err != nil {
		t.Fatalf("ReadBoulder failed: %v", err)
	}

	// Test ReadPlan with absolute path
	plan, err := ReadPlan(boulder.ActivePlan)
	if err != nil {
		t.Fatalf("ReadPlan with absolute path failed: %v", err)
	}

	if plan.Completed != 1 {
		t.Errorf("Expected 1 completed, got %d", plan.Completed)
	}

	if plan.Total != 2 {
		t.Errorf("Expected 2 total, got %d", plan.Total)
	}
}
