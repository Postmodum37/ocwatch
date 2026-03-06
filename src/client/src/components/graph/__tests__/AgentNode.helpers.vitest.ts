import { describe, it, expect } from 'vitest';
import type { ToolInput } from '@shared/types';
import { extractPrimaryArg, getFullToolDisplayText } from '../nodeHelpers';

describe('extractPrimaryArg', () => {
  it('returns filePath when present', () => {
    const input: ToolInput = {
      filePath: '/tmp/project/src/index.ts',
      command: 'ls',
    };

    expect(extractPrimaryArg(input)).toBe('/tmp/project/src/index.ts');
  });

  it('falls back to command when filePath is missing', () => {
    const input: ToolInput = { command: 'bun run test' };

    expect(extractPrimaryArg(input)).toBe('bun run test');
  });

  it('truncates long values with a leading ellipsis', () => {
    const longPath = '/Users/tomas/Workspace/ocwatch/' + 'a'.repeat(90) + '/index.ts';
    const input: ToolInput = { filePath: longPath };
    const result = extractPrimaryArg(input);

    expect(result).not.toBeNull();
    expect(result?.startsWith('...')).toBe(true);
    expect(result).toBe('...' + longPath.slice(-60));
  });

  it('returns null when no recognized keys exist', () => {
    const input: ToolInput = { unknownKey: 'value' };

    expect(extractPrimaryArg(input)).toBeNull();
  });

  it('skips empty string values', () => {
    const input: ToolInput = {
      filePath: '',
      command: '',
      query: 'latest query',
    };

    expect(extractPrimaryArg(input)).toBe('latest query');
  });
});

describe('getFullToolDisplayText', () => {
  it('returns null for empty toolCalls', () => {
    expect(getFullToolDisplayText([])).toBeNull();
    expect(getFullToolDisplayText(undefined)).toBeNull();
  });

  it('strips mcp_ prefix from tool name', () => {
    const result = getFullToolDisplayText([
      {
        name: 'mcp_bash',
        input: { command: 'pwd' },
      },
    ]);

    expect(result).toEqual({
      toolName: 'bash',
      toolArg: 'pwd',
    });
  });

  it('uses the first (latest) tool call', () => {
    const result = getFullToolDisplayText([
      {
        name: 'mcp_bash',
        input: { command: 'latest command' },
      },
      {
        name: 'mcp_read',
        input: { filePath: '/older/value.ts' },
      },
    ]);

    expect(result).toEqual({
      toolName: 'bash',
      toolArg: 'latest command',
    });
  });
});
