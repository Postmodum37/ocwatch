import type { ToolInput } from '@shared/types';

export const PRIMARY_ARG_KEYS = ['filePath', 'command', 'pattern', 'query', 'url'] as const;
export const MAX_ARG_LENGTH = 60;

/** Extract the most relevant argument from a tool input for display */
export function extractPrimaryArg(input: ToolInput): string | null {
  for (const key of PRIMARY_ARG_KEYS) {
    const value = input[key];
    if (typeof value !== 'string' || value === '') continue;
    return value.length > MAX_ARG_LENGTH ? '...' + value.slice(-MAX_ARG_LENGTH) : value;
  }
  return null;
}

/** Get display text for the latest tool call */
export function getFullToolDisplayText(toolCalls?: { name: string; input: ToolInput }[]): { toolName: string; toolArg: string | null } | null {
  if (!toolCalls || toolCalls.length === 0) return null;
  const latest = toolCalls[0];
  const toolName = latest.name.replace('mcp_', '');
  const toolArg = extractPrimaryArg(latest.input);
  return { toolName, toolArg };
}
