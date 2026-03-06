import type { SessionMetadata, MessageMeta, PartMeta } from "../../shared/types";
import { MESSAGE_SCAN_LIMIT } from "../../shared/constants";
import {
  queryMessages,
  queryParts,
} from "../storage/queries";
import {
  toMessageMeta as parseMessageRow,
  toPartMeta as parsePartRow,
} from "./parsing";

export interface SessionContext {
  allowedSessionIds: Set<string>;
  sessionById: Map<string, SessionMetadata>;
  messagesBySession: Map<string, MessageMeta[]>;
  partsBySession: Map<string, PartMeta[]>;
  childrenBySession: Map<string, SessionMetadata[]>;
}

interface SessionContextSeed {
  messagesBySession?: Map<string, MessageMeta[]>;
  partsBySession?: Map<string, PartMeta[]>;
}

export function createSessionContext(allSessions: SessionMetadata[], seed: SessionContextSeed = {}): SessionContext {
  const sessionById = new Map<string, SessionMetadata>();
  const childrenBySession = new Map<string, SessionMetadata[]>();
  for (const session of allSessions) {
    sessionById.set(session.id, session);
    if (!session.parentID) {
      continue;
    }

    const siblings = childrenBySession.get(session.parentID);
    if (siblings) {
      siblings.push(session);
    } else {
      childrenBySession.set(session.parentID, [session]);
    }
  }

  for (const children of childrenBySession.values()) {
    children.sort((a, b) => {
      const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
      if (createdDiff !== 0) {
        return createdDiff;
      }

      return a.id.localeCompare(b.id);
    });
  }

  return {
    allowedSessionIds: new Set(allSessions.map((session) => session.id)),
    sessionById,
    messagesBySession: new Map<string, MessageMeta[]>(seed.messagesBySession),
    partsBySession: new Map<string, PartMeta[]>(seed.partsBySession),
    childrenBySession,
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

  const messages = queryMessages(sessionId, MESSAGE_SCAN_LIMIT).map(parseMessageRow);
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

  const children: SessionMetadata[] = [];
  context.childrenBySession.set(sessionId, children);
  return children;
}
