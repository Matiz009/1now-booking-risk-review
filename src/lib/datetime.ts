/**
 * The date helpers this project actually needs, instead of a date library.
 *
 * All of them are pure and take explicit arguments — no `Date.now()` anywhere —
 * so anything built on top of them is deterministic and testable.
 *
 * Note that `new Date(ms)` arithmetic is UTC-based, so these are unaffected by
 * daylight-saving shifts in the local zone (adding 24 hours always adds exactly
 * 24 hours, which is what the risk rules mean).
 */

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * MS_PER_HOUR);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Fractional minutes from `from` to `to`. Negative when `to` is earlier.
 * Exact for whole minutes, so "179 vs 180 minutes" edges compare cleanly.
 */
export function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_MINUTE;
}

/** Fractional hours from `from` to `to`. Negative when `to` is earlier. */
export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_HOUR;
}

/** Fractional days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY;
}
