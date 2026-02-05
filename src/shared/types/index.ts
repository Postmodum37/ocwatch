/**
 * Core TypeScript types for OCWatch
 * Ported from Go types in internal/state/state.go and internal/parser/parser.go
 */

export type SessionStatus = "working" | "idle" | "completed" | "waiting";

export interface SessionMetadata {
  id: string;
  projectID: string;
  directory: string;
  title: string;
  parentID?: string;
  agent?: string | null;
  modelID?: string | null;
  providerID?: string | null;
  status?: SessionStatus;
  activityType?: SessionActivityType;
  currentAction?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MessageMeta represents a message in a session
 */
export interface MessageMeta {
  id: string;
  sessionID: string;
  role: string;
  agent?: string;
  mode?: string;
  modelID?: string;
  providerID?: string;
  parentID?: string;
  tokens?: number;
  cost?: number;
  createdAt: Date;
  finish?: string;
}

/**
 * ActivitySession represents a session in the live activity view
 * Includes agent info and hierarchy
 */
export type SessionActivityType = "tool" | "reasoning" | "patch" | "waiting-tools" | "waiting-user" | "idle";

export interface ActivitySession {
  id: string;
  title: string;
  agent: string;
  modelID?: string;
  providerID?: string;
  parentID?: string;
  tokens?: number;
  status?: SessionStatus;
  currentAction?: string | null;
  activityType?: SessionActivityType;
  pendingToolCount?: number;
  patchFilesCount?: number;
  lastToolCompletedAt?: Date;
  workingChildCount?: number;
  toolCalls?: ToolCallSummary[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PartMeta represents a part file (tool call)
 */
export interface ToolInput {
  filePath?: string;
  command?: string;
  pattern?: string;
  url?: string;
  query?: string;
  [key: string]: unknown;
}

export interface PartMeta {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
  callID?: string;
  tool?: string;
  state?: string;
  input?: ToolInput;
  title?: string;
  startedAt?: Date;
  completedAt?: Date;
  stepSnapshot?: string;
  stepFinishReason?: "stop" | "tool-calls";
  reasoningText?: string;
  patchFiles?: string[];
}

/**
 * AgentInfo represents an active agent
 */
export interface AgentInfo {
  name: string;
  mode: string;
  modelID: string;
  active: boolean;
  sessionID: string;
}

/**
 * ToolCall represents a tool invocation
 */
export interface ToolCall {
  id: string;
  name: string;
  state: "pending" | "complete" | "error";
  timestamp: Date;
  sessionID: string;
  messageID: string;
}

/**
 * ToolCallSummary represents a summary of a tool call with input args
 */
export interface ToolCallSummary {
  id: string;
  name: string;
  state: "pending" | "complete" | "error";
  summary: string;
  input: object;
  timestamp: string;
  agentName: string;
}

/**
 * ActivityType enum for activity stream events
 */
export type ActivityType = "tool-call" | "agent-spawn" | "agent-complete";

/**
 * ToolCallActivity represents a tool invocation in the activity stream
 */
export interface ToolCallActivity {
  id: string;
  type: "tool-call";
  timestamp: Date;
  agentName: string;
  toolName: string;
  state: "pending" | "complete" | "error";
  summary?: string;
  input?: object;
  error?: string;
}

/**
 * AgentSpawnActivity represents an agent being spawned
 */
export interface AgentSpawnActivity {
  id: string;
  type: "agent-spawn";
  timestamp: Date;
  agentName: string;
  spawnedAgentName: string;
}

/**
 * AgentCompleteActivity represents an agent completing
 */
export interface AgentCompleteActivity {
  id: string;
  type: "agent-complete";
  timestamp: Date;
  agentName: string;
  status: SessionStatus;
  durationMs?: number;
}

/**
 * ActivityItem is a union type of all activity events
 */
export type ActivityItem =
  | ToolCallActivity
  | AgentSpawnActivity
  | AgentCompleteActivity;

export { synthesizeActivityItems } from '../utils/activityUtils';

/**
 * PlanProgress represents progress on a plan
 */
export interface PlanProgress {
  completed: number;
  total: number;
  progress: number; // 0-100
  tasks: Array<{ description: string; completed: boolean }>;
}

/**
 * ModelTokens represents token usage for a specific model
 */
export interface ModelTokens {
  modelID: string;
  providerID?: string;
  tokens: number;
}

/**
 * SessionStats represents aggregated statistics for a session
 */
export interface SessionStats {
  totalTokens: number;
  totalCost?: number;
  modelBreakdown: ModelTokens[];
}

/**
 * Boulder represents the current plan state
 */
export interface Boulder {
  activePlan?: string;
  sessionIDs: string[];
  status: string;
  startedAt: Date;
  planName: string;
}

/**
 * ProjectInfo represents a project with session count
 */
export interface ProjectInfo {
  id: string;
  directory: string;
  sessionCount: number;
  lastActivityAt: Date;
}

/**
 * TreeNode represents a node in the session/agent tree visualization
 * Used for React Flow tree rendering
 */
export interface TreeNode {
  id: string;
  data: {
    title: string;
    agent?: string;
    model?: string;
    isActive: boolean;
  };
}

/**
 * TreeEdge represents a connection between nodes in the tree
 */
export interface TreeEdge {
  source: string;
  target: string;
}

/**
 * SessionTree represents the complete tree structure for React Flow
 * Contains nodes and edges for visualization
 */
export interface SessionTree {
  nodes: TreeNode[];
  edges: TreeEdge[];
}

/**
 * AgentPhase represents a continuous period of agent activity
 * Groups consecutive messages from the same agent
 */
export interface AgentPhase {
  agent: string;
  startTime: Date;
  endTime: Date;
  tokens: number;
  messageCount: number;
}

/**
 * PollResponse is the response from the /api/poll endpoint
 * Contains current session state, plan progress, and activity data
 */
export interface PollResponse {
  sessions: SessionMetadata[];
  activeSession: SessionMetadata | null;
  planProgress: PlanProgress | null;
  messages: MessageMeta[];
  activitySessions: ActivitySession[];
  sessionStats?: SessionStats;
  lastUpdate: number;
}

export { RingBuffer } from '../utils/RingBuffer';
