/**
 * Display formatting. Pure, and `formatRelative` takes `now` as a parameter so
 * it can be tested without faking the clock (CLAUDE.md).
 *
 * The Intl formatters are built once at module load rather than per call —
 * constructing one is comparatively expensive and these are hit once per row.
 */

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** "Oct 9" — no year, for the left side of a same-year range. */
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** "Oct 9, 2026" */
const monthDayYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'always' });

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

/** `$1,234` — whole dollars; cents are noise on a rental total. */
export function formatCurrency(amount: number): string {
  return currency.format(amount);
}

/** `Oct 9, 2026` */
export function formatDate(date: Date): string {
  return monthDayYear.format(date);
}

/**
 * `Oct 9 – Oct 12, 2026`, collapsing the year when both ends share it and
 * collapsing to a single date for a same-day trip.
 */
export function formatDateRange(start: Date, end: Date): string {
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return formatDate(start);
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${monthDay.format(start)} – ${formatDate(end)}`;
  }

  return `${formatDate(start)} – ${formatDate(end)}`;
}

/**
 * `in 2 hours` / `3 days ago` / `just now`, relative to the `now` you pass in.
 *
 * Each unit is used up to the point where the next one reads better: minutes
 * below an hour, hours below a day, and so on.
 */
export function formatRelative(date: Date, now: Date): string {
  const seconds = (date.getTime() - now.getTime()) / 1000;
  const magnitude = Math.abs(seconds);

  if (magnitude < 45) {
    return 'just now';
  }
  if (magnitude < SECONDS_PER_HOUR) {
    return relative.format(Math.round(seconds / SECONDS_PER_MINUTE), 'minute');
  }
  if (magnitude < SECONDS_PER_DAY) {
    return relative.format(Math.round(seconds / SECONDS_PER_HOUR), 'hour');
  }
  if (magnitude < 30 * SECONDS_PER_DAY) {
    return relative.format(Math.round(seconds / SECONDS_PER_DAY), 'day');
  }
  if (magnitude < 365 * SECONDS_PER_DAY) {
    return relative.format(Math.round(seconds / (30 * SECONDS_PER_DAY)), 'month');
  }
  return relative.format(Math.round(seconds / (365 * SECONDS_PER_DAY)), 'year');
}
