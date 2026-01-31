package plan

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

type Boulder struct {
	ActivePlan string   `json:"active_plan"`
	SessionIDs []string `json:"session_ids"`
	Status     string   `json:"status"`
	StartedAt  string   `json:"started_at"`
	PlanName   string   `json:"plan_name"`
}

type PlanProgress struct {
	Completed int
	Total     int
	Progress  float64
}

type Plan struct {
}

func NewPlan() *Plan {
	return &Plan{}
}

func ReadBoulder(projectDir string) (*Boulder, error) {
	boulderPath := filepath.Join(projectDir, ".sisyphus", "boulder.json")

	data, err := os.ReadFile(boulderPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read boulder.json: %w", err)
	}

	var boulder Boulder
	if err := json.Unmarshal(data, &boulder); err != nil {
		return nil, fmt.Errorf("failed to parse boulder.json: %w", err)
	}

	if !filepath.IsAbs(boulder.ActivePlan) {
		boulder.ActivePlan = filepath.Join(projectDir, boulder.ActivePlan)
	}

	return &boulder, nil
}

func ReadPlan(planPath string) (*PlanProgress, error) {
	data, err := os.ReadFile(planPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read plan file: %w", err)
	}

	content := string(data)
	completed, total := CalculateProgress(content)

	progress := float64(0)
	if total > 0 {
		progress = float64(completed) / float64(total)
	}

	return &PlanProgress{
		Completed: completed,
		Total:     total,
		Progress:  progress,
	}, nil
}

func CalculateProgress(planContent string) (completed, total int) {
	checkboxRegex := regexp.MustCompile(`-\s+\[([ xX])\]`)

	matches := checkboxRegex.FindAllStringSubmatch(planContent, -1)

	for _, match := range matches {
		total++
		if match[1] == "x" || match[1] == "X" {
			completed++
		}
	}

	return completed, total
}
