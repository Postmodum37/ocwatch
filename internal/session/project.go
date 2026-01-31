package session

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"
)

type Project struct {
	ID       string
	Worktree string
	Created  time.Time
	Updated  time.Time
}

type projectJSON struct {
	ID       string `json:"id"`
	Worktree string `json:"worktree"`
	VCS      string `json:"vcs"`
	Time     struct {
		Created int64 `json:"created"`
		Updated int64 `json:"updated"`
	} `json:"time"`
}

func ListAllProjects(storagePath string) ([]Project, error) {
	projectDir := filepath.Join(storagePath, "storage", "project")

	entries, err := os.ReadDir(projectDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read project directory: %w", err)
	}

	var projects []Project
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		filePath := filepath.Join(projectDir, entry.Name())
		data, err := os.ReadFile(filePath)
		if err != nil {
			continue
		}

		var pj projectJSON
		if err := json.Unmarshal(data, &pj); err != nil {
			continue
		}

		if pj.Worktree == "/" {
			continue
		}

		projects = append(projects, Project{
			ID:       pj.ID,
			Worktree: pj.Worktree,
			Created:  time.UnixMilli(pj.Time.Created),
			Updated:  time.UnixMilli(pj.Time.Updated),
		})
	}

	sort.Slice(projects, func(i, j int) bool {
		return projects[i].Updated.After(projects[j].Updated)
	})

	return projects, nil
}

func ListAllSessions(storagePath string) ([]Session, error) {
	projects, err := ListAllProjects(storagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to list projects: %w", err)
	}

	projectMap := make(map[string]string)
	for _, p := range projects {
		projectMap[p.ID] = p.Worktree
	}

	var allSessions []Session
	for _, project := range projects {
		sessions, err := ListSessionsWithPath(storagePath, project.ID)
		if err != nil {
			continue
		}

		for _, session := range sessions {
			session.ProjectWorktree = projectMap[session.ProjectID]
			allSessions = append(allSessions, session)
		}
	}

	sort.Slice(allSessions, func(i, j int) bool {
		return allSessions[i].Updated.After(allSessions[j].Updated)
	})

	return allSessions, nil
}
