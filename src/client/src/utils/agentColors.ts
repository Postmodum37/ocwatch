export function getAgentColor(agent: string | null | undefined): string {
  const lowerAgent = agent?.toLowerCase() || '';
  
  if (lowerAgent.includes('sisyphus')) return '#3b82f6'; // blue
  if (lowerAgent.includes('prometheus')) return '#a855f7'; // purple
  if (lowerAgent.includes('explore') || lowerAgent.includes('librarian')) return '#22c55e'; // green
  if (lowerAgent.includes('oracle')) return '#f59e0b'; // amber
  if (lowerAgent.includes('build')) return '#06b6d4'; // cyan
  
  return '#6b7280'; // gray
}

export const AGENT_COLORS = {
  sisyphus: '#3b82f6',
  prometheus: '#a855f7',
  explore: '#22c55e',
  librarian: '#22c55e',
  oracle: '#f59e0b',
  build: '#06b6d4',
  default: '#6b7280',
} as const;
