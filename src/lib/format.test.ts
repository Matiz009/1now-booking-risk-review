import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatRelative,
} from '@/lib/format';
import { addDays, addHours, addMinutes } from '@/lib/datetime';

/**
 * Dates here are built from local components (`new Date(y, m, d)`) and
 * formatted in the local zone, so these assertions hold whatever TZ the test
 * runner is in.
 */

describe('formatCurrency', () => {
  it('groups thousands and drops cents', () => {
    expect(formatCurrency(1234)).toBe('$1,234');
    expect(formatCurrency(5460)).toBe('$5,460');
  });

  it('handles small and zero amounts', () => {
    expect(formatCurrency(0)).toBe('$0');
    expect(formatCurrency(207)).toBe('$207');
  });

  it('rounds rather than showing cents', () => {
    expect(formatCurrency(99.5)).toBe('$100');
  });
});

describe('formatDateRange', () => {
  it('collapses the year when both ends share it', () => {
    const start = new Date(2026, 9, 9); // 9 Oct 2026
    const end = new Date(2026, 9, 12);
    expect(formatDateRange(start, end)).toBe('Oct 9 – Oct 12, 2026');
  });

  it('keeps both years when the trip crosses new year', () => {
    const start = new Date(2026, 11, 30);
    const end = new Date(2027, 0, 2);
    expect(formatDateRange(start, end)).toBe('Dec 30, 2026 – Jan 2, 2027');
  });

  it('shows a single date for a same-day trip', () => {
    const start = new Date(2026, 9, 9, 9, 0);
    const end = new Date(2026, 9, 9, 18, 0);
    expect(formatDateRange(start, end)).toBe('Oct 9, 2026');
  });

  it('spans months within the same year', () => {
    expect(formatDateRange(new Date(2026, 9, 28), new Date(2026, 10, 4))).toBe(
      'Oct 28 – Nov 4, 2026',
    );
  });
});

describe('formatDateTime', () => {
  it('renders the date and a 12-hour time', () => {
    // \s: newer ICU puts a narrow no-break space before AM/PM.
    expect(formatDateTime(new Date(2026, 9, 7, 11, 42))).toMatch(/^Oct 7, 2026, 11:42\sAM$/);
  });
});

describe('formatDate', () => {
  it('renders a short month, day and year', () => {
    expect(formatDate(new Date(2026, 0, 1))).toBe('Jan 1, 2026');
  });
});

describe('formatRelative', () => {
  const now = new Date(2026, 9, 7, 12, 0);

  it('calls anything inside 45 seconds "just now"', () => {
    expect(formatRelative(now, now)).toBe('just now');
    expect(formatRelative(addMinutes(now, 0.5), now)).toBe('just now');
  });

  it('reads minutes below an hour', () => {
    expect(formatRelative(addMinutes(now, 20), now)).toBe('in 20 minutes');
    expect(formatRelative(addMinutes(now, -5), now)).toBe('5 minutes ago');
  });

  it('reads hours below a day', () => {
    expect(formatRelative(addHours(now, 2), now)).toBe('in 2 hours');
    expect(formatRelative(addHours(now, -3), now)).toBe('3 hours ago');
  });

  it('reads days below a month', () => {
    expect(formatRelative(addDays(now, 1), now)).toBe('in 1 day');
    expect(formatRelative(addDays(now, -6), now)).toBe('6 days ago');
  });

  it('reads months, then years', () => {
    expect(formatRelative(addDays(now, -90), now)).toBe('3 months ago');
    expect(formatRelative(addDays(now, -730), now)).toBe('2 years ago');
  });

  it('switches unit at the boundary rather than saying "in 60 minutes"', () => {
    expect(formatRelative(addMinutes(now, 59), now)).toBe('in 59 minutes');
    expect(formatRelative(addMinutes(now, 61), now)).toBe('in 1 hour');
  });
});
