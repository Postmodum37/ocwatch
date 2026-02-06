export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return tokens.toString();
}

export function formatCost(cost: number | undefined | null): string {
  if (cost === undefined || cost === null) return '—';
  return `$${cost.toFixed(2)}`;
}

export function formatDuration(start: Date | string, end: Date | string): string {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const diffMs = Math.max(0, endMs - startMs);
  const totalMinutes = Math.floor(diffMs / 60_000);

  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function shortModelName(modelID: string): string {
  const lower = modelID.toLowerCase();

  // Regex: family-major[-minor][-YYYYMMDD] → "family-major.minor" (minor ≤ 2 digits, not 8-digit date)
  const claudeMatch = lower.match(/(opus|sonnet|haiku)-(\d+)(?:-(\d+))?(?:-\d{8})?/);
  if (claudeMatch) {
    const [, family, major, minor] = claudeMatch;
    if (minor && minor.length <= 2) {
      return `${family}-${major}.${minor}`;
    }
    return `${family}-${major}`;
  }

  if (lower.includes('opus')) return 'opus';
  if (lower.includes('sonnet')) return 'sonnet';
  if (lower.includes('haiku')) return 'haiku';

  if (lower.includes('gpt-5')) return 'gpt-5';
  if (lower.includes('gpt-4o')) return 'gpt-4o';
  if (lower.includes('gpt-4')) return 'gpt-4';

  if (lower.includes('gemini-3')) return 'gemini-3';
  if (lower.includes('gemini-2')) return 'gemini-2';
  if (lower.includes('gemini')) return 'gemini';

  if (lower.includes('codex')) return 'codex';

  if (lower.includes('grok')) {
    const grokMatch = lower.match(/grok[\w-]*/);
    const grokName = grokMatch ? grokMatch[0] : 'grok';
    return grokName.replace(/-\d{8}$/, '');
  }

  const parts = modelID.split('/');
  const last = parts[parts.length - 1];
  const cleaned = last.replace(/-\d{8}$/, '');
  return cleaned.length > 16 ? `${cleaned.slice(0, 15)}…` : cleaned;
}
