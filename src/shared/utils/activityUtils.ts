import type { ActivitySession, ActivityItem } from '../types';

export function synthesizeActivityItems(
  sessions: ActivitySession[]
): ActivityItem[] {
  const items: ActivityItem[] = [];
  const sessionMap = new Map<string, ActivitySession>();
  const seenToolCallIds = new Set<string>();

  sessions.forEach((session) => {
    sessionMap.set(session.id, session);
  });

  sessions.forEach((session) => {
    if (session.parentID && sessionMap.has(session.parentID)) {
      const parent = sessionMap.get(session.parentID)!;
      items.push({
        id: `spawn-${session.id}`,
        type: "agent-spawn",
        timestamp: session.createdAt,
        agentName: parent.agent,
        spawnedAgentName: session.agent,
      });
    }

    if (session.toolCalls && session.toolCalls.length > 0) {
      session.toolCalls.forEach((toolCall) => {
        if (seenToolCallIds.has(toolCall.id)) return;
        seenToolCallIds.add(toolCall.id);
        
        items.push({
          id: toolCall.id,
          type: "tool-call",
          timestamp: new Date(toolCall.timestamp),
          agentName: toolCall.agentName,
          toolName: toolCall.name,
          state: toolCall.state,
          summary: toolCall.summary,
          input: toolCall.input,
          error: toolCall.error,
        });
      });
    }

    if (session.status === "completed") {
      const durationMs = session.updatedAt
        ? new Date(session.updatedAt).getTime() -
          new Date(session.createdAt).getTime()
        : undefined;

      items.push({
        id: `complete-${session.id}`,
        type: "agent-complete",
        timestamp: session.updatedAt,
        agentName: session.agent,
        status: session.status,
        durationMs,
      });
    }
  });

  items.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return items;
}
