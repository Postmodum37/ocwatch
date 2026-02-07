/**
 * Boulder Parser - Parse .sisyphus/boulder.json for plan progress
 * Reads plan state and calculates progress from markdown checkboxes
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Boulder, PlanProgress } from "../../shared/types";

/**
 * Internal JSON structure from .sisyphus/boulder.json
 * Note: Sisyphus writes snake_case keys to disk
 */
interface BoulderJSON {
  active_plan?: string;
  session_ids: string[];
  status: string;
  started_at: string | number;
  plan_name: string;
  // Legacy camelCase format (kept for backwards compatibility)
  activePlan?: string;
  sessionIDs?: string[];
  startedAt?: string | number;
  planName?: string;
}

/**
 * Parse boulder.json file
 * @param projectDir - Project directory containing .sisyphus/boulder.json
 * @returns Boulder or null if file doesn't exist or is invalid
 */
export async function parseBoulder(projectDir: string): Promise<Boulder | null> {
  try {
    const filePath = join(projectDir, ".sisyphus", "boulder.json");
    const content = await readFile(filePath, "utf-8");
    const json: BoulderJSON = JSON.parse(content);

    let activePlan = json.active_plan ?? json.activePlan;
    if (activePlan && !activePlan.startsWith("/")) {
      activePlan = join(projectDir, activePlan);
    }

    const sessionIDs = json.session_ids ?? json.sessionIDs ?? [];
    const startedAt = json.started_at ?? json.startedAt;
    const planName = json.plan_name ?? json.planName ?? "";

    return {
      activePlan,
      sessionIDs,
      status: json.status,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      planName,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn(`Corrupted boulder.json: ${projectDir}/.sisyphus/boulder.json`);
    }
    return null;
  }
}

/**
 * Calculate progress from markdown plan file
 * Counts checkboxes: - [ ] (incomplete) vs - [x] or - [X] (complete)
 * @param planPath - Absolute path to plan markdown file
 * @returns PlanProgress or null if file doesn't exist
 */
export async function calculatePlanProgress(
  planPath: string
): Promise<PlanProgress | null> {
  try {
    const content = await readFile(planPath, "utf-8");
    const { completed, total, tasks } = parseCheckboxes(content);

    const progress = total > 0 ? (completed / total) * 100 : 0;

    return {
      completed,
      total,
      progress,
      tasks,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Parse markdown checkboxes from plan content
 * @param content - Markdown content
 * @returns Object with completed count, total count, and task list
 */
function parseCheckboxes(content: string): {
  completed: number;
  total: number;
  tasks: Array<{ description: string; completed: boolean }>;
} {
  const checkboxRegex = /-\s+\[([ xX])\]\s*(.+)/g;
  const matches = [...content.matchAll(checkboxRegex)];

  let completed = 0;
  const tasks: Array<{ description: string; completed: boolean }> = [];

  for (const match of matches) {
    const isChecked = match[1] === "x" || match[1] === "X";
    const taskText = match[2].trim();

    if (isChecked) {
      completed++;
    }

    tasks.push({
      description: taskText,
      completed: isChecked,
    });
  }

  return {
    completed,
    total: matches.length,
    tasks,
  };
}
