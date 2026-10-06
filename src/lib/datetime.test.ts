import { describe, expect, it } from 'vitest';
import { addDays, addHours, addMinutes, daysBetween, hoursBetween } from '@/lib/datetime';

// A fixed instant. Using UTC so the test means the same thing on any machine.
const base = new Date('2026-10-07T12:00:00.000Z');

describe('addMinutes / addHours / addDays', () => {
  it('moves forward', () => {
    expect(addMinutes(base, 90).toISOString()).toBe('2026-10-07T13:30:00.000Z');
    expect(addHours(base, 5).toISOString()).toBe('2026-10-07T17:00:00.000Z');
    expect(addDays(base, 3).toISOString()).toBe('2026-10-10T12:00:00.000Z');
  });

  it('moves backward with a negative amount', () => {
    expect(addHours(base, -12).toISOString()).toBe('2026-10-07T00:00:00.000Z');
    expect(addDays(base, -7).toISOString()).toBe('2026-09-30T12:00:00.000Z');
  });

  it('does not mutate the date it is given', () => {
    const before = base.toISOString();
    addDays(base, 400);
    expect(base.toISOString()).toBe(before);
  });

  it('crosses a daylight-saving boundary without drifting', () => {
    // US DST ended 2026-11-01. Adding 24h must add exactly 24h.
    const beforeDst = new Date('2026-10-31T18:00:00.000Z');
    expect(addDays(beforeDst, 1).toISOString()).toBe('2026-11-01T18:00:00.000Z');
  });
});

describe('hoursBetween / daysBetween', () => {
  it('measures forward distance', () => {
    expect(hoursBetween(base, addHours(base, 3))).toBe(3);
    expect(daysBetween(base, addDays(base, 14))).toBe(14);
  });

  it('returns a fraction rather than rounding', () => {
    expect(hoursBetween(base, addMinutes(base, 90))).toBe(1.5);
    expect(daysBetween(base, addHours(base, 36))).toBe(1.5);
  });

  it('is negative when the second date is earlier', () => {
    expect(hoursBetween(base, addHours(base, -2))).toBe(-2);
  });

  it('is zero for the same instant', () => {
    expect(hoursBetween(base, new Date(base.getTime()))).toBe(0);
  });
});
