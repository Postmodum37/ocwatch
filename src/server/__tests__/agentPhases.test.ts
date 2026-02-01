import { describe, it, expect } from "bun:test";
import type { MessageMeta } from "../../shared/types";

interface AgentPhase {
  agent: string;
  startTime: Date;
  endTime: Date;
  tokens: number;
  messageCount: number;
}

function detectAgentPhases(messages: MessageMeta[]): AgentPhase[] {
  const sorted = messages
    .filter(m => m.role === 'assistant' && m.agent)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  
  if (sorted.length === 0) return [];
  
  const phases: AgentPhase[] = [];
  let currentPhase: AgentPhase | null = null;
  
  for (const msg of sorted) {
    if (!currentPhase || currentPhase.agent !== msg.agent) {
      if (currentPhase) phases.push(currentPhase);
      currentPhase = {
        agent: msg.agent!,
        startTime: msg.createdAt,
        endTime: msg.createdAt,
        tokens: msg.tokens || 0,
        messageCount: 1,
      };
    } else {
      currentPhase.endTime = msg.createdAt;
      currentPhase.tokens += msg.tokens || 0;
      currentPhase.messageCount++;
    }
  }
  if (currentPhase) phases.push(currentPhase);
  
  return phases;
}

describe('detectAgentPhases', () => {
  it('returns empty array for no messages', () => {
    const result = detectAgentPhases([]);
    expect(result).toEqual([]);
  });

  it('returns single phase for single agent', () => {
    const messages: MessageMeta[] = [
      { id: '1', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:00:00') },
      { id: '2', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:05:00') },
    ];
    const result = detectAgentPhases(messages);
    expect(result).toHaveLength(1);
    expect(result[0].agent).toBe('prometheus');
    expect(result[0].messageCount).toBe(2);
  });

  it('returns two phases for agent transition', () => {
    const messages: MessageMeta[] = [
      { id: '1', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:00:00') },
      { id: '2', sessionID: 's1', role: 'assistant', agent: 'atlas', createdAt: new Date('2024-01-01T10:30:00') },
    ];
    const result = detectAgentPhases(messages);
    expect(result).toHaveLength(2);
    expect(result[0].agent).toBe('prometheus');
    expect(result[1].agent).toBe('atlas');
  });

  it('creates new phase when agent returns', () => {
    const messages: MessageMeta[] = [
      { id: '1', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:00:00') },
      { id: '2', sessionID: 's1', role: 'assistant', agent: 'atlas', createdAt: new Date('2024-01-01T10:30:00') },
      { id: '3', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T11:00:00') },
    ];
    const result = detectAgentPhases(messages);
    expect(result).toHaveLength(3);
    expect(result[0].agent).toBe('prometheus');
    expect(result[1].agent).toBe('atlas');
    expect(result[2].agent).toBe('prometheus');
  });

  it('skips messages without agent field', () => {
    const messages: MessageMeta[] = [
      { id: '1', sessionID: 's1', role: 'user', createdAt: new Date('2024-01-01T10:00:00') },
      { id: '2', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:05:00') },
    ];
    const result = detectAgentPhases(messages);
    expect(result).toHaveLength(1);
    expect(result[0].agent).toBe('prometheus');
  });

  it('skips user messages', () => {
    const messages: MessageMeta[] = [
      { id: '1', sessionID: 's1', role: 'user', agent: 'prometheus', createdAt: new Date('2024-01-01T10:00:00') },
      { id: '2', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:05:00') },
    ];
    const result = detectAgentPhases(messages);
    expect(result).toHaveLength(1);
    expect(result[0].messageCount).toBe(1);
  });

  it('accumulates tokens within a phase', () => {
    const messages: MessageMeta[] = [
      { id: '1', sessionID: 's1', role: 'assistant', agent: 'prometheus', tokens: 100, createdAt: new Date('2024-01-01T10:00:00') },
      { id: '2', sessionID: 's1', role: 'assistant', agent: 'prometheus', tokens: 200, createdAt: new Date('2024-01-01T10:05:00') },
    ];
    const result = detectAgentPhases(messages);
    expect(result[0].tokens).toBe(300);
  });

  it('handles messages without tokens', () => {
    const messages: MessageMeta[] = [
      { id: '1', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:00:00') },
      { id: '2', sessionID: 's1', role: 'assistant', agent: 'prometheus', tokens: 100, createdAt: new Date('2024-01-01T10:05:00') },
    ];
    const result = detectAgentPhases(messages);
    expect(result[0].tokens).toBe(100);
  });

  it('sets correct startTime and endTime for phase', () => {
    const messages: MessageMeta[] = [
      { id: '1', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:00:00') },
      { id: '2', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:30:00') },
    ];
    const result = detectAgentPhases(messages);
    expect(result[0].startTime).toEqual(new Date('2024-01-01T10:00:00'));
    expect(result[0].endTime).toEqual(new Date('2024-01-01T10:30:00'));
  });

  it('handles out-of-order messages by sorting them', () => {
    const messages: MessageMeta[] = [
      { id: '2', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:30:00') },
      { id: '1', sessionID: 's1', role: 'assistant', agent: 'prometheus', createdAt: new Date('2024-01-01T10:00:00') },
    ];
    const result = detectAgentPhases(messages);
    expect(result[0].startTime).toEqual(new Date('2024-01-01T10:00:00'));
    expect(result[0].endTime).toEqual(new Date('2024-01-01T10:30:00'));
  });
});
