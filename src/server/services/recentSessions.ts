interface HasRootSessionFields {
  parentID?: string | null;
  updatedAt: Date;
}

export function selectRecentRootSessions<T extends HasRootSessionFields>(
  sessions: readonly T[],
  limit: number,
): T[] {
  return sessions
    .filter((session) => !session.parentID)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, limit);
}
