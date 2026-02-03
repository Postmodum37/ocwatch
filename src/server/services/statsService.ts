import type { SessionStats, ActivitySession, MessageMeta } from "../../shared/types";

/**
 * Aggregate session statistics from activity sessions and their messages
 * @param activitySessions - Array of activity sessions
 * @param allMessages - Map of sessionID to messages
 * @returns SessionStats with total tokens, cost, and model breakdown
 */
export function aggregateSessionStats(
  activitySessions: ActivitySession[],
  allMessages: Map<string, MessageMeta[]>
): SessionStats {
  let totalTokens = 0;
  let totalCost = 0;
  let hasCost = false;
  const modelTokensMap = new Map<string, { modelID: string; providerID?: string; tokens: number }>();

  for (const session of activitySessions) {
    const messages = allMessages.get(session.id) || [];
    
    for (const msg of messages) {
      if (msg.tokens) {
        totalTokens += msg.tokens;
        
        const modelKey = `${msg.modelID || 'unknown'}:${msg.providerID || ''}`;
        const existing = modelTokensMap.get(modelKey);
        if (existing) {
          existing.tokens += msg.tokens;
        } else {
          modelTokensMap.set(modelKey, {
            modelID: msg.modelID || 'unknown',
            providerID: msg.providerID,
            tokens: msg.tokens,
          });
        }
      }
      
      if (msg.cost !== undefined) {
        totalCost += msg.cost;
        hasCost = true;
      }
    }
  }

  const modelBreakdown = Array.from(modelTokensMap.values())
    .sort((a, b) => b.tokens - a.tokens);

  return {
    totalTokens,
    totalCost: hasCost ? totalCost : undefined,
    modelBreakdown,
  };
}
