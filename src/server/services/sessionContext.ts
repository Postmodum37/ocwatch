import type { SessionMetadata, MessageMeta, PartMeta } from "../../shared/types";
import {
  querySessionChildren,
  queryMessages,
  queryParts,
} from "../storage/queries";
import {
  toSessionMetadata as parseSessionRow,
  toMessageMeta as parseMessageRow,
  toPartMeta as parsePartRow,
} from "./parsing";

/** Max messages to load per session for hierarchy building (effectively unlimited) */
const MAX_MESSAGE_QUERY_LIMIT = 100_000;

export interface SessionContext {
  allowedSessionIds: Set<string>;
  sessionById: Map<string, SessionMetadata>;
  messagesBySession: Map<string, MessageMeta[]>;
  partsBySession: Map<string, PartMeta[]>;
  childrenBySession: Map<string, SessionMetadata[]>;
}

export function createSessionContext(allSessions: SessionMetadata[]): SessionContext {
  const sessionById = new Map<string, SessionMetadata>();
  for (const session of allSessions) {
    sessionById.set(session.id, session);
  }

  return {
    allowedSessionIds: new Set(allSessions.map((session) => session.id)),
    sessionById,
    messagesBySession: new Map<string, MessageMeta[]>(),
    partsBySession: new Map<string, PartMeta[]>(),
    childrenBySession: new Map<string, SessionMetadata[]>(),
  };
}

export function getSessionFromContext(sessionId: string, context: SessionContext): SessionMetadata | undefined {
  return context.sessionById.get(sessionId);
}

export function getSessionMessages(sessionId: string, context: SessionContext): MessageMeta[] {
  const cached = context.messagesBySession.get(sessionId);
  if (cached) {
    return cached;
  }

  const messages = queryMessages(sessionId, MAX_MESSAGE_QUERY_LIMIT).map(parseMessageRow);
  context.messagesBySession.set(sessionId, messages);
  return messages;
}

export function getSessionParts(sessionId: string, context: SessionContext): PartMeta[] {
  const cached = context.partsBySession.get(sessionId);
  if (cached) {
    return cached;
  }

  const parts = queryParts(sessionId).map(parsePartRow);
  context.partsBySession.set(sessionId, parts);
  return parts;
}

export function getSessionChildren(sessionId: string, context: SessionContext): SessionMetadata[] {
  const cached = context.childrenBySession.get(sessionId);
  if (cached) {
    return cached;
  }

  const children = querySessionChildren(sessionId)
    .map(parseSessionRow)
    .filter((child) => context.allowedSessionIds.has(child.id));

  for (const child of children) {
    if (!context.sessionById.has(child.id)) {
      context.sessionById.set(child.id, child);
    }
  }

  context.childrenBySession.set(sessionId, children);
  return children;
}
