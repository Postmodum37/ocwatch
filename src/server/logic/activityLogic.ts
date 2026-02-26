import type { PartMeta, SessionActivityType, SessionStatus } from "../../shared/types";

const MAX_PATH_LENGTH = 40;

function truncatePath(path: string): string {
  if (path.length <= MAX_PATH_LENGTH) {
    return path;
  }
  return "..." + path.slice(-MAX_PATH_LENGTH + 3);
}

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  read: "Reading",
  write: "Writing",
  edit: "Editing",
  bash: "Running",
  grep: "Searching",
  glob: "Finding",
  task: "Delegating",
  webfetch: "Fetching",
  agent: "Agent",
  subtask: "Subtask",
  compaction: "Context Compaction",
  file: "File",
};

function getToolDisplayName(tool: string): string {
  const normalized = tool.replace(/^mcp_/, "").toLowerCase();
  return TOOL_DISPLAY_NAMES[normalized] || tool;
}

export function formatCurrentAction(part: PartMeta): string | null {
  if (!part.tool) {
    return null;
  }

  const toolName = getToolDisplayName(part.tool);

  if (part.tool === "task" || part.tool === "delegate_task") {
    const input = part.input as { description?: string; subagent_type?: string } | undefined;
    const desc = input?.description;
    const agentType = input?.subagent_type;
    if (desc && agentType) return `${desc} (${agentType})`;
    if (desc) return desc;
    if (agentType) return `Delegating (${agentType})`;
    return "Delegating task";
  }

  if (part.tool === "agent" || part.tool === "subtask") {
    const input = part.input as { description?: string; subagent_type?: string; name?: string } | undefined;
    const desc = input?.description;
    const name = input?.name;
    const agentType = input?.subagent_type;
    if (desc) return desc;
    if (name) return `${toolName}: ${name}`;
    if (agentType) return `${toolName} (${agentType})`;
    return toolName;
  }

  if (part.tool === "compaction") {
    return "Compacting context";
  }

  if (part.tool === "todowrite") {
    const input = part.input as { todos?: Array<{ content?: string }> } | undefined;
    const todos = input?.todos;
    if (!todos || todos.length === 0) return "Cleared todos";
    const preview = todos
      .slice(0, 2)
      .map(t => (t.content || "").slice(0, 30))
      .filter(Boolean)
      .join(", ");
    return `Updated ${todos.length} todo${todos.length !== 1 ? "s" : ""}: ${preview}${todos.length > 2 ? "..." : ""}`;
  }

  if (part.tool === "todoread") {
    return "Reading todos";
  }

  if (part.input) {
    if (part.input.filePath) {
      return `${toolName} ${truncatePath(part.input.filePath)}`;
    }
    if (part.input.command) {
      const cmd = part.input.command.length > 30
        ? part.input.command.slice(0, 27) + "..."
        : part.input.command;
      return `${toolName} ${cmd}`;
    }
    if (part.input.pattern) {
      return `${toolName} for "${part.input.pattern}"`;
    }
    if (part.input.url) {
      return `${toolName} ${truncatePath(part.input.url)}`;
    }
    if (part.input.query) {
      return `${toolName} "${part.input.query}"`;
    }
  }

  if (part.title) {
    return part.title;
  }

  return toolName;
}

const ACTIVE_TOOL_STATES = ["pending", "running", "in_progress"];

export function isPendingToolCall(part: PartMeta): boolean {
  if (!part.tool || part.type !== "tool") {
    return false;
  }

  if (!part.state) {
    return false;
  }

  return ACTIVE_TOOL_STATES.includes(part.state);
}

export interface SessionActivityState {
  hasPendingToolCall: boolean;
  pendingCount: number;
  completedCount: number;
  lastToolCompletedAt: Date | null;
  isReasoning: boolean;
  reasoningPreview: string | null;
  patchFilesCount: number;
  stepFinishReason: "stop" | "tool-calls" | null;
  activeToolNames: string[];
}

export function getSessionActivityState(parts: PartMeta[]): SessionActivityState {
  let pendingCount = 0;
  let completedCount = 0;
  let lastToolCompletedAt: Date | null = null;
  let isReasoning = false;
  let reasoningPreview: string | null = null;
  let patchFilesCount = 0;
  let stepFinishReason: "stop" | "tool-calls" | null = null;
  const activeToolNames: string[] = [];

  const sortedParts = [...parts].sort((a, b) => {
    const timeA = a.startedAt?.getTime() || 0;
    const timeB = b.startedAt?.getTime() || 0;
    return timeB - timeA;
  });

  for (const part of sortedParts) {
    if (part.type === "tool" && part.tool) {
      if (isPendingToolCall(part)) {
        pendingCount++;
        activeToolNames.push(part.tool.replace(/^mcp_/, ""));
      } else if (part.state === "completed") {
        completedCount++;
        if (part.completedAt && (!lastToolCompletedAt || part.completedAt > lastToolCompletedAt)) {
          lastToolCompletedAt = part.completedAt;
        }
      }
    }

    if (part.type === "reasoning" && part.reasoningText && !isReasoning) {
      isReasoning = true;
      const text = part.reasoningText.trim();
      reasoningPreview = text.length > 40 ? text.slice(0, 37) + "..." : text;
    }

    if (part.type === "patch" && part.patchFiles && !part.completedAt) {
      patchFilesCount += part.patchFiles.length;
    }

    if (part.type === "step-finish" && part.stepFinishReason && !stepFinishReason) {
      stepFinishReason = part.stepFinishReason;
    }
  }

  return {
    hasPendingToolCall: pendingCount > 0,
    pendingCount,
    completedCount,
    lastToolCompletedAt,
    isReasoning,
    reasoningPreview,
    patchFilesCount,
    stepFinishReason,
    activeToolNames,
  };
}

export function deriveActivityType(
  activityState: SessionActivityState,
  lastAssistantFinished: boolean,
  isSubagent: boolean,
  status: SessionStatus,
  waitingReason?: "user" | "children"
): SessionActivityType {
  if (status === "completed") {
    return "idle";
  }
  if ((waitingReason === "user" || (!waitingReason && lastAssistantFinished)) && !isSubagent && status === "waiting") {
    return "waiting-user";
  }
  if (activityState.pendingCount > 0) {
    return "tool";
  }
  if (activityState.isReasoning) {
    return "reasoning";
  }
  if (activityState.patchFilesCount > 0) {
    return "patch";
  }
  if (activityState.stepFinishReason === "tool-calls") {
    return "waiting-tools";
  }
  return "idle";
}

export function generateActivityMessage(
  activityState: SessionActivityState,
  lastAssistantFinished: boolean,
  isSubagent: boolean,
  status: SessionStatus,
  pendingPart?: PartMeta,
  waitingReason?: "user" | "children"
): string | null {
  if (status === "completed") {
    return null;
  }
  if ((waitingReason === "user" || (!waitingReason && lastAssistantFinished)) && !isSubagent && status === "waiting") {
    return "Waiting for user input";
  }

  if (activityState.pendingCount > 1) {
    const toolNames = activityState.activeToolNames.slice(0, 3).join(", ");
    const firstToolAction = pendingPart ? formatCurrentAction(pendingPart) : null;
    if (firstToolAction) {
      return `Running ${activityState.pendingCount} tools (${firstToolAction})`;
    }
    return `Running ${activityState.pendingCount} tools: ${toolNames}${activityState.activeToolNames.length > 3 ? "..." : ""}`;
  }

  if (activityState.pendingCount === 1 && pendingPart) {
    return formatCurrentAction(pendingPart);
  }

  if (activityState.isReasoning && activityState.reasoningPreview) {
    return `Analyzing: ${activityState.reasoningPreview}`;
  }

  if (activityState.patchFilesCount > 0) {
    return `Writing ${activityState.patchFilesCount} file${activityState.patchFilesCount !== 1 ? "s" : ""}...`;
  }

  if (activityState.stepFinishReason === "tool-calls") {
    return "Waiting for tool results";
  }

  return null;
}
