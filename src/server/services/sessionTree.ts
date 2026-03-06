import type {
  SessionMetadata,
  TreeNode,
  TreeEdge,
  SessionTree,
} from "../../shared/types";
import { MAX_RECURSION_DEPTH } from "../../shared/constants";
import {
  isAssistantFinished,
  getSessionStatusInfo,
} from "../logic";
import {
  createSessionContext,
  getSessionFromContext,
  getSessionMessages,
  getSessionChildren,
} from "./sessionContext";

export async function buildSessionTree(
  rootSessionID: string,
  allSessions: SessionMetadata[]
): Promise<SessionTree> {
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  const visited = new Set<string>();
  const context = createSessionContext(allSessions);

  async function processSession(sessionID: string, depth = 0) {
    if (depth > MAX_RECURSION_DEPTH) {
      console.warn(`Max recursion depth reached for session ${sessionID}`);
      return;
    }
    if (visited.has(sessionID)) {
      return;
    }
    visited.add(sessionID);

    const session = getSessionFromContext(sessionID, context);
    if (!session) {
      return;
    }

    const messages = getSessionMessages(sessionID, context);
    const lastAssistantFinished = isAssistantFinished(messages);
    const isSubagent = !!session.parentID;
    const status = getSessionStatusInfo(
      messages,
      false,
      undefined,
      undefined,
      lastAssistantFinished,
      isSubagent
    ).status;

    const lastMessage = messages.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )[0];

    nodes.push({
      id: session.id,
      data: {
        title: session.title,
        agent: lastMessage?.agent,
        model: lastMessage?.modelID,
        isActive: status === "working" || status === "idle",
      },
    });

    if (session.parentID) {
      edges.push({
        source: session.parentID,
        target: session.id,
      });
      await processSession(session.parentID, depth + 1);
    }

    const children = getSessionChildren(sessionID, context);
    await Promise.all(
      children.map((child) => {
        edges.push({
          source: sessionID,
          target: child.id,
        });
        return processSession(child.id, depth + 1);
      })
    );
  }

  await processSession(rootSessionID, 0);

  return { nodes, edges };
}
