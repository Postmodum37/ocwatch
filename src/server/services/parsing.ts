/**
 * Shared parsing functions for converting database rows to domain types.
 *
 * This module is the SINGLE SOURCE OF TRUTH for DB row → domain object mapping.
 * Both pollService and sessionService import from here — never duplicate these functions.
 */

import type {
  SessionMetadata,
  MessageMeta,
  PartMeta,
} from "../../shared/types";
import type { DbSessionRow, DbMessageRow, DbPartRow } from "../storage/queries";
import { isPendingToolCall } from "../logic";

// ---------------------------------------------------------------------------
// JSON shapes (internal to this module)
// ---------------------------------------------------------------------------

interface MessageJSON {
  role?: string;
  agent?: string;
  mode?: string;
  modelID?: string;
  providerID?: string;
  model?: {
    modelID?: string;
    providerID?: string;
  };
  parentID?: string;
  cost?: number;
  tokens?: {
    input?: number;
    output?: number;
  };
  finish?: string;
  time?: {
    created?: number;
  };
}

interface PartStateJSON {
  status?: string;
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  title?: string;
  time?: {
    start?: number;
    end?: number;
  };
}

interface PartJSON {
  type?: string;
  callID?: string;
  tool?: string;
  state?: string | PartStateJSON;
  text?: string;
  title?: string;
  reason?: string;
  files?: unknown;
  input?: Record<string, unknown>;
  time?: {
    start?: number;
    end?: number;
  };
  snapshot?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseJsonData<T>(raw: unknown): T | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  if (raw && typeof raw === "object") {
    return raw as T;
  }

  return null;
}

function toStringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toDate(value: unknown): Date | undefined {
  return typeof value === "number" ? new Date(value) : undefined;
}

function toStringArrayOrUndefined(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length > 0 ? items : undefined;
}

// ---------------------------------------------------------------------------
// Row → Domain converters
// ---------------------------------------------------------------------------

export function toSessionMetadata(row: DbSessionRow): SessionMetadata {
  return {
    id: row.id,
    projectID: row.projectID,
    directory: row.directory,
    title: row.title,
    parentID: row.parentID ?? undefined,
    createdAt: new Date(row.timeCreated),
    updatedAt: new Date(row.timeUpdated),
  };
}

export function toMessageMeta(row: DbMessageRow): MessageMeta {
  const json = parseJsonData<MessageJSON>(row.data) ?? {};
  const tokenInput = json.tokens?.input;
  const tokenOutput = json.tokens?.output;
  const hasTokens = typeof tokenInput === "number" || typeof tokenOutput === "number";

  return {
    id: row.id,
    sessionID: row.sessionID,
    role: json.role ?? row.role ?? "unknown",
    agent: toStringOrUndefined(json.agent),
    mode: toStringOrUndefined(json.mode),
    modelID: toStringOrUndefined(json.modelID) ?? toStringOrUndefined(json.model?.modelID),
    providerID: toStringOrUndefined(json.providerID) ?? toStringOrUndefined(json.model?.providerID),
    parentID: toStringOrUndefined(json.parentID),
    tokens: hasTokens ? (tokenInput ?? 0) + (tokenOutput ?? 0) : undefined,
    cost: typeof json.cost === "number" ? json.cost : undefined,
    createdAt: new Date(json.time?.created ?? row.timeCreated),
    finish: toStringOrUndefined(json.finish),
  };
}

export function toPartMeta(row: DbPartRow): PartMeta {
  const json = parseJsonData<PartJSON>(row.data) ?? {};

  const stateObject = (typeof json.state === "object" && json.state !== null)
    ? json.state as PartStateJSON
    : undefined;

  const state = toStringOrUndefined(json.state) ?? toStringOrUndefined(stateObject?.status) ?? row.state ?? undefined;

  const nestedInput = (stateObject?.input && typeof stateObject.input === "object")
    ? stateObject.input as Record<string, unknown>
    : undefined;
  const rootInput = (json.input && typeof json.input === "object")
    ? json.input as Record<string, unknown>
    : undefined;
  const input = nestedInput ?? rootInput;

  const title = toStringOrUndefined(stateObject?.title) ?? toStringOrUndefined(json.title);

  const time = (json.time && typeof json.time === "object") ? json.time : stateObject?.time;
  const startedAt = toDate(time?.start);
  const completedAt = toDate(time?.end);

  const errorRaw = toStringOrUndefined(stateObject?.error) ?? toStringOrUndefined(stateObject?.output);
  const error = (state === "error" || state === "failed") && errorRaw
    ? errorRaw.slice(0, 500)
    : undefined;

  const reason = json.reason;
  const stepFinishReason = reason === "stop" || reason === "tool-calls" ? reason : undefined;
  const type = toStringOrUndefined(json.type) ?? row.type ?? "unknown";

  return {
    id: row.id,
    sessionID: row.sessionID,
    messageID: row.messageID,
    type,
    callID: toStringOrUndefined(json.callID),
    tool: toStringOrUndefined(json.tool) ?? row.tool ?? undefined,
    state,
    input,
    title,
    error,
    startedAt,
    completedAt,
    stepSnapshot: toStringOrUndefined(json.snapshot),
    stepFinishReason,
    reasoningText: type === "reasoning" ? toStringOrUndefined(json.text) : undefined,
    patchFiles: toStringArrayOrUndefined(json.files),
  };
}

// ---------------------------------------------------------------------------
// Common query helpers (used by both pollService and sessionService)
// ---------------------------------------------------------------------------

export function getLatestAssistantMessage(messages: MessageMeta[]): MessageMeta | undefined {
  return messages
    .filter((message) => message.role === "assistant")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

export function getMostRecentPendingPart(parts: PartMeta[]): PartMeta | undefined {
  return parts
    .filter((part) => isPendingToolCall(part))
    .sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0))[0];
}
