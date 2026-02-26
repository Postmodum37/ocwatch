import { describe, it, expect } from 'bun:test';
import {
  formatCurrentAction,
  getSessionActivityState,
  TOOL_DISPLAY_NAMES,
  deriveActivityType,
  generateActivityMessage,
} from '../server/logic/activityLogic';
import type { PartMeta } from '../shared/types';

function makePart(overrides: Partial<PartMeta>): PartMeta {
  return {
    id: 'part-1',
    sessionID: 'ses_test',
    messageID: 'msg-1',
    type: 'tool',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// TOOL_DISPLAY_NAMES
// ---------------------------------------------------------------------------

describe('TOOL_DISPLAY_NAMES', () => {
  it('contains expected tool keys', () => {
    expect(TOOL_DISPLAY_NAMES).toHaveProperty('read');
    expect(TOOL_DISPLAY_NAMES).toHaveProperty('bash');
    expect(TOOL_DISPLAY_NAMES).toHaveProperty('task');
    expect(TOOL_DISPLAY_NAMES).toHaveProperty('agent');
    expect(TOOL_DISPLAY_NAMES).toHaveProperty('compaction');
    expect(TOOL_DISPLAY_NAMES).toHaveProperty('file');
  });

  it('maps tool names to display strings', () => {
    expect(TOOL_DISPLAY_NAMES['read']).toBe('Reading');
    expect(TOOL_DISPLAY_NAMES['bash']).toBe('Running');
    expect(TOOL_DISPLAY_NAMES['task']).toBe('Delegating');
    expect(TOOL_DISPLAY_NAMES['agent']).toBe('Agent');
    expect(TOOL_DISPLAY_NAMES['compaction']).toBe('Context Compaction');
    expect(TOOL_DISPLAY_NAMES['file']).toBe('File');
  });
});

// ---------------------------------------------------------------------------
// formatCurrentAction
// ---------------------------------------------------------------------------

describe('formatCurrentAction', () => {
  it('returns null when part has no tool', () => {
    const part = makePart({ type: 'text', tool: undefined });
    expect(formatCurrentAction(part)).toBeNull();
  });

  it('formats read tool with filePath', () => {
    const part = makePart({ tool: 'read', input: { filePath: '/src/index.ts' } });
    const result = formatCurrentAction(part);
    expect(result).toContain('Reading');
    expect(result).toContain('index.ts');
  });

  it('formats bash tool with command', () => {
    const part = makePart({ tool: 'bash', input: { command: 'ls -la' } });
    const result = formatCurrentAction(part);
    expect(result).toContain('Running');
    expect(result).toContain('ls -la');
  });

  it('formats task tool with description and subagent_type', () => {
    const part = makePart({
      tool: 'task',
      input: { description: 'Do something', subagent_type: 'explore' },
    });
    const result = formatCurrentAction(part);
    expect(result).toContain('Do something');
    expect(result).toContain('explore');
  });

  it('formats task tool with description only', () => {
    const part = makePart({ tool: 'task', input: { description: 'Do something' } });
    expect(formatCurrentAction(part)).toBe('Do something');
  });

  it('formats task tool with subagent_type only', () => {
    const part = makePart({ tool: 'task', input: { subagent_type: 'oracle' } });
    const result = formatCurrentAction(part);
    expect(result).toContain('oracle');
  });

  it('formats task tool with no input', () => {
    const part = makePart({ tool: 'task' });
    expect(formatCurrentAction(part)).toBe('Delegating task');
  });

  it('formats agent tool with description', () => {
    const part = makePart({ tool: 'agent', input: { description: 'Search the web' } });
    expect(formatCurrentAction(part)).toBe('Search the web');
  });

  it('formats agent tool with name', () => {
    const part = makePart({ tool: 'agent', input: { name: 'librarian' } });
    const result = formatCurrentAction(part);
    expect(result).toContain('librarian');
  });

  it('formats agent tool with subagent_type only', () => {
    const part = makePart({ tool: 'agent', input: { subagent_type: 'oracle' } });
    const result = formatCurrentAction(part);
    expect(result).toContain('oracle');
  });

  it('formats compaction tool', () => {
    const part = makePart({ tool: 'compaction' });
    expect(formatCurrentAction(part)).toBe('Compacting context');
  });

  it('returns title for file tool with title', () => {
    const part = makePart({ tool: 'file', title: 'some-file.ts' });
    expect(formatCurrentAction(part)).toBe('some-file.ts');
  });

  it('returns display name for file tool without title', () => {
    const part = makePart({ tool: 'file' });
    expect(formatCurrentAction(part)).toBe('File');
  });

  it('returns toolName for unknown tool with no input', () => {
    const part = makePart({ tool: 'someUnknownTool' });
    expect(formatCurrentAction(part)).toBe('someUnknownTool');
  });

  it('returns title for unknown tool with title and no recognized input', () => {
    const part = makePart({ tool: 'someunknown', title: 'My Title' });
    expect(formatCurrentAction(part)).toBe('My Title');
  });

  it('formats grep tool with pattern', () => {
    const part = makePart({ tool: 'grep', input: { pattern: 'useState' } });
    const result = formatCurrentAction(part);
    expect(result).toContain('Searching');
    expect(result).toContain('useState');
  });

  it('formats webfetch tool with url', () => {
    const part = makePart({ tool: 'webfetch', input: { url: 'https://example.com/page' } });
    const result = formatCurrentAction(part);
    expect(result).toContain('Fetching');
  });

  it('strips mcp_ prefix when looking up display name', () => {
    const part = makePart({ tool: 'mcp_bash' });
    const result = formatCurrentAction(part);
    // mcp_bash normalizes to "bash" → "Running"
    expect(result).toBe('Running');
  });

  it('truncates long filePaths', () => {
    const longPath = '/very/long/path/that/exceeds/forty/characters/in/total/src/index.ts';
    const part = makePart({ tool: 'read', input: { filePath: longPath } });
    const result = formatCurrentAction(part);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThan(longPath.length + 10); // truncated
  });

  it('truncates long bash commands', () => {
    const longCmd = 'bun run test --watch --coverage --reporter=verbose';
    const part = makePart({ tool: 'bash', input: { command: longCmd } });
    const result = formatCurrentAction(part);
    expect(result).toContain('Running');
    expect(result!.length).toBeLessThan(60); // command is truncated at 30 chars + "..."
  });
});

// ---------------------------------------------------------------------------
// getSessionActivityState
// ---------------------------------------------------------------------------

describe('getSessionActivityState', () => {
  it('returns all-zero state for empty parts array', () => {
    const state = getSessionActivityState([]);
    expect(state.hasPendingToolCall).toBe(false);
    expect(state.pendingCount).toBe(0);
    expect(state.completedCount).toBe(0);
    expect(state.lastToolCompletedAt).toBeNull();
    expect(state.isReasoning).toBe(false);
    expect(state.reasoningPreview).toBeNull();
    expect(state.patchFilesCount).toBe(0);
    expect(state.stepFinishReason).toBeNull();
    expect(state.activeToolNames).toEqual([]);
  });

  it('detects pending tool call (state: pending)', () => {
    const parts: PartMeta[] = [
      makePart({ type: 'tool', tool: 'bash', state: 'pending', startedAt: new Date() }),
    ];
    const state = getSessionActivityState(parts);
    expect(state.hasPendingToolCall).toBe(true);
    expect(state.pendingCount).toBe(1);
    expect(state.activeToolNames).toContain('bash');
  });

  it('detects pending tool call (state: running)', () => {
    const parts: PartMeta[] = [
      makePart({ type: 'tool', tool: 'read', state: 'running', startedAt: new Date() }),
    ];
    const state = getSessionActivityState(parts);
    expect(state.hasPendingToolCall).toBe(true);
    expect(state.pendingCount).toBe(1);
  });

  it('detects pending tool call (state: in_progress)', () => {
    const parts: PartMeta[] = [
      makePart({ type: 'tool', tool: 'grep', state: 'in_progress', startedAt: new Date() }),
    ];
    const state = getSessionActivityState(parts);
    expect(state.hasPendingToolCall).toBe(true);
  });

  it('ignores tool parts without a state', () => {
    const parts: PartMeta[] = [
      makePart({ type: 'tool', tool: 'bash' }), // no state
    ];
    const state = getSessionActivityState(parts);
    expect(state.hasPendingToolCall).toBe(false);
    expect(state.pendingCount).toBe(0);
  });

  it('detects completed tool call and sets lastToolCompletedAt', () => {
    const completedAt = new Date('2025-01-01T12:00:00Z');
    const parts: PartMeta[] = [
      makePart({ type: 'tool', tool: 'read', state: 'completed', completedAt }),
    ];
    const state = getSessionActivityState(parts);
    expect(state.completedCount).toBe(1);
    expect(state.lastToolCompletedAt).toEqual(completedAt);
  });

  it('picks the most recent completedAt across multiple completed parts', () => {
    const earlier = new Date('2025-01-01T11:00:00Z');
    const later = new Date('2025-01-01T12:00:00Z');
    const parts: PartMeta[] = [
      makePart({ id: 'p1', type: 'tool', tool: 'read', state: 'completed', completedAt: earlier }),
      makePart({ id: 'p2', type: 'tool', tool: 'bash', state: 'completed', completedAt: later }),
    ];
    const state = getSessionActivityState(parts);
    expect(state.completedCount).toBe(2);
    expect(state.lastToolCompletedAt).toEqual(later);
  });

  it('detects reasoning state and sets reasoningPreview', () => {
    const parts: PartMeta[] = [
      makePart({ type: 'reasoning', reasoningText: 'Thinking about the problem at hand...' }),
    ];
    const state = getSessionActivityState(parts);
    expect(state.isReasoning).toBe(true);
    expect(state.reasoningPreview).not.toBeNull();
  });

  it('truncates long reasoning text in preview', () => {
    const longText = 'A'.repeat(100);
    const parts: PartMeta[] = [
      makePart({ type: 'reasoning', reasoningText: longText }),
    ];
    const state = getSessionActivityState(parts);
    expect(state.isReasoning).toBe(true);
    expect(state.reasoningPreview!.length).toBeLessThanOrEqual(43); // 37 + "..."
  });

  it('does not set isReasoning if reasoningText is empty/absent', () => {
    const parts: PartMeta[] = [
      makePart({ type: 'reasoning' }), // no reasoningText
    ];
    const state = getSessionActivityState(parts);
    expect(state.isReasoning).toBe(false);
  });

  it('counts multiple pending tool calls', () => {
    const parts: PartMeta[] = [
      makePart({ id: 'p1', type: 'tool', tool: 'bash', state: 'running', startedAt: new Date() }),
      makePart({ id: 'p2', type: 'tool', tool: 'read', state: 'pending', startedAt: new Date() }),
    ];
    const state = getSessionActivityState(parts);
    expect(state.pendingCount).toBe(2);
    expect(state.hasPendingToolCall).toBe(true);
    expect(state.activeToolNames).toHaveLength(2);
  });

  it('strips mcp_ prefix from active tool names', () => {
    const parts: PartMeta[] = [
      makePart({ type: 'tool', tool: 'mcp_bash_tool', state: 'pending', startedAt: new Date() }),
    ];
    const state = getSessionActivityState(parts);
    expect(state.activeToolNames).toContain('bash_tool');
  });

  it('ignores non-tool part types for pending/completed counts', () => {
    const parts: PartMeta[] = [
      makePart({ type: 'text' }), // not a tool
      makePart({ type: 'reasoning', reasoningText: 'thinking...' }),
    ];
    const state = getSessionActivityState(parts);
    expect(state.pendingCount).toBe(0);
    expect(state.completedCount).toBe(0);
  });
});

describe('deriveActivityType', () => {
  it("returns 'tool' when there is a pending tool", () => {
    const activityState = getSessionActivityState([
      makePart({ type: 'tool', tool: 'bash', state: 'pending', startedAt: new Date() }),
    ]);

    const result = deriveActivityType(activityState, false, false, 'working');
    expect(result).toBe('tool');
  });

  it("returns 'reasoning' when reasoning is active", () => {
    const activityState = getSessionActivityState([
      makePart({ type: 'reasoning', reasoningText: 'Thinking through options' }),
    ]);

    const result = deriveActivityType(activityState, false, false, 'working');
    expect(result).toBe('reasoning');
  });

  it("returns 'patch' when there are active patch files", () => {
    const activityState = getSessionActivityState([
      makePart({ type: 'patch', patchFiles: ['src/a.ts', 'src/b.ts'] }),
    ]);

    const result = deriveActivityType(activityState, false, false, 'working');
    expect(result).toBe('patch');
  });

  it("returns 'waiting-user' when waiting for user input", () => {
    const activityState = getSessionActivityState([]);
    const result = deriveActivityType(activityState, true, false, 'waiting', 'user');
    expect(result).toBe('waiting-user');
  });

  it("returns 'idle' for completed sessions", () => {
    const activityState = getSessionActivityState([]);
    const result = deriveActivityType(activityState, false, false, 'completed');
    expect(result).toBe('idle');
  });
});

describe('generateActivityMessage', () => {
  it('returns pending tool action message', () => {
    const pendingPart = makePart({
      type: 'tool',
      tool: 'bash',
      state: 'pending',
      input: { command: 'ls -la' },
      startedAt: new Date(),
    });
    const activityState = getSessionActivityState([pendingPart]);

    const message = generateActivityMessage(activityState, false, false, 'working', pendingPart);
    expect(message).toContain('Running');
  });

  it("returns waiting-user message when waiting for user", () => {
    const activityState = getSessionActivityState([]);
    const message = generateActivityMessage(activityState, true, false, 'waiting', undefined, 'user');
    expect(message).toBe('Waiting for user input');
  });

  it('returns null for completed status', () => {
    const activityState = getSessionActivityState([]);
    const message = generateActivityMessage(activityState, false, false, 'completed');
    expect(message).toBeNull();
  });

  it('returns reasoning message when reasoning preview exists', () => {
    const activityState = getSessionActivityState([
      makePart({ type: 'reasoning', reasoningText: 'Break the task into smaller steps first' }),
    ]);

    const message = generateActivityMessage(activityState, false, false, 'working');
    expect(message).toContain('Analyzing:');
  });
});
