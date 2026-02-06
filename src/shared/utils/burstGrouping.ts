import type {
  ActivityItem,
  BurstEntry,
  MilestoneEntry,
  StreamEntry,
  ToolCallActivity,
} from "../types";

function isMilestone(item: ActivityItem): boolean {
  if (item.type === "agent-spawn" || item.type === "agent-complete") {
    return true;
  }

  return item.type === "tool-call" && item.state === "error";
}

function createBurstEntry(items: ToolCallActivity[]): BurstEntry {
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const toolBreakdown: Record<string, number> = {};

  let pendingCount = 0;
  let errorCount = 0;

  for (const item of items) {
    toolBreakdown[item.toolName] = (toolBreakdown[item.toolName] ?? 0) + 1;

    if (item.state === "pending") {
      pendingCount += 1;
    }

    if (item.state === "error") {
      errorCount += 1;
    }
  }

  return {
    id: first.id,
    type: "burst",
    agentName: first.agentName,
    items,
    toolBreakdown,
    durationMs: new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime(),
    firstTimestamp: new Date(first.timestamp),
    lastTimestamp: new Date(last.timestamp),
    pendingCount,
    errorCount,
  };
}

export function groupIntoBursts(items: ActivityItem[]): StreamEntry[] {
  const entries: StreamEntry[] = [];
  let currentBurstItems: ToolCallActivity[] = [];
  const chronologicalItems = [...items].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const flushCurrentBurst = () => {
    if (currentBurstItems.length === 0) {
      return;
    }

    entries.push(createBurstEntry(currentBurstItems));
    currentBurstItems = [];
  };

  for (const item of chronologicalItems) {
    if (isMilestone(item)) {
      flushCurrentBurst();

      const milestone: MilestoneEntry = {
        id: item.id,
        type: "milestone",
        item,
      };

      entries.push(milestone);
      continue;
    }

    if (item.type !== "tool-call") {
      continue;
    }

    const currentAgentName = currentBurstItems[0]?.agentName;
    const shouldStartNewBurst =
      currentBurstItems.length > 0 && currentAgentName !== item.agentName;

    if (shouldStartNewBurst) {
      flushCurrentBurst();
    }

    currentBurstItems.push(item);
  }

  flushCurrentBurst();

  return entries;
}
