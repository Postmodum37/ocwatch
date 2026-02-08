import { describe, it, expect } from 'bun:test';
import { formatRelativeTime } from '../utils/formatTime';

describe('formatRelativeTime', () => {
  it('returns empty string for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(formatRelativeTime(null)).toBe('');
  });

  it('returns empty string for invalid date string', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
  });

  it("returns '<1m' for dates less than 1 minute ago", () => {
    const fortySecondsAgo = new Date(Date.now() - 40_000);

    expect(formatRelativeTime(fortySecondsAgo)).toBe('<1m');
  });

  it('returns proper format for valid dates', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000);

    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m');
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h');
  });
});
