import { describe, it, expect } from 'vitest';
import { formatDayLabel, formatAdminTimestamp, formatAdminDate } from '../formatTimestamp';

describe('formatDayLabel', () => {
  it('renders an ISO day as a readable month + day, dropping the leading zero', () => {
    expect(formatDayLabel('2026-07-13')).toBe('Jul 13');
    expect(formatDayLabel('2026-01-01')).toBe('Jan 1');
    expect(formatDayLabel('2026-12-09')).toBe('Dec 9');
  });
});

describe('formatAdminDate', () => {
  it('renders a full unambiguous date with a spelled-out month', () => {
    expect(formatAdminDate('2026-07-13T10:00:00Z')).toContain('2026');
    expect(formatAdminDate('2026-07-13T10:00:00Z')).toMatch(/^[A-Za-z]{3} \d{1,2}, 2026$/);
  });

  it('falls back to the raw string for an unparseable input rather than throwing', () => {
    expect(formatAdminDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatAdminTimestamp', () => {
  const NOW = new Date('2026-07-13T12:00:00Z');

  it('appends "just now" for a timestamp seconds ago', () => {
    const t = new Date(NOW.getTime() - 3000).toISOString();
    expect(formatAdminTimestamp(t, NOW)).toMatch(/just now$/);
  });

  it('appends a minutes-ago label within the last hour', () => {
    const t = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatAdminTimestamp(t, NOW)).toMatch(/5 min ago$/);
  });

  it('appends an hours-ago label within the last day', () => {
    const t = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatAdminTimestamp(t, NOW)).toMatch(/3 hr ago$/);
  });

  it('says "yesterday" for exactly one day ago', () => {
    const t = new Date(NOW.getTime() - 25 * 60 * 60 * 1000).toISOString();
    expect(formatAdminTimestamp(t, NOW)).toMatch(/yesterday$/);
  });

  it('drops the relative hint once the timestamp is more than 6 days old', () => {
    const t = new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const out = formatAdminTimestamp(t, NOW);
    expect(out).not.toContain('ago');
    expect(out).not.toContain('yesterday');
  });

  it('includes an unambiguous absolute date and a 12-hour time', () => {
    const out = formatAdminTimestamp('2026-01-05T15:30:00Z', new Date('2026-03-01T00:00:00Z'));
    expect(out).toMatch(/^Jan 5, 2026, \d{1,2}:\d{2} (AM|PM)/);
  });

  it('falls back to the raw string for an unparseable input rather than throwing', () => {
    expect(formatAdminTimestamp('not-a-date')).toBe('not-a-date');
  });
});
