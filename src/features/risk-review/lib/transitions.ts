import type { BookingStatus } from '../types';

/**
 * Which status changes are allowed. A plain lookup table rather than a chain
 * of `if`s, so adding a status (e.g. "hold") is one new key plus the edges
 * into and out of it.
 *
 * `Record<BookingStatus, ...>` makes TypeScript require a key for every
 * status in the union: add a status to types.ts and this file stops compiling
 * until you decide where it can go.
 */
const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  needs_review: ['approved', 'verification_requested', 'declined'],
  verification_requested: ['approved', 'declined'],
  approved: [],
  declined: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Every status reachable from `from`. Empty means `from` is final. */
export function nextStatuses(from: BookingStatus): readonly BookingStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
