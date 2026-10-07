import { mockBookings } from '../data/bookings.mock';
import { DECLINE_REASON_MIN_LENGTH } from '../lib/risk.config';
import { canTransition } from '../lib/transitions';
import type { ApiConfig, Booking, BookingStatus } from '../types';

/**
 * A pretend backend: an in-memory list behind async functions, with a delay
 * and switchable failures. Only `useBookings` calls this (CLAUDE.md rule 3).
 *
 * It re-checks the same rules the UI checks (transitions, decline reason),
 * because a real server would never trust the client to have done it.
 */

const DEFAULT_CONFIG: ApiConfig = {
  delayMs: 600,
  failLoad: false,
  failUpdate: false,
  failUpdateIds: [],
};

let config: ApiConfig = { ...DEFAULT_CONFIG };
let store: Booking[] = mockBookings.map(cloneBooking);

/** Change some settings, keep the rest. Used by DevPanel and by tests. */
export function configureApi(next: Partial<ApiConfig>): void {
  config = { ...config, ...next };
}

export function getApiConfig(): ApiConfig {
  return { ...config };
}

/** Back to default settings and a fresh copy of the data. Call in each test's beforeEach. */
export function resetApi(bookings: Booking[] = mockBookings): void {
  config = { ...DEFAULT_CONFIG };
  store = bookings.map(cloneBooking);
}

export async function getBookings(): Promise<Booking[]> {
  await wait(config.delayMs);

  if (config.failLoad) {
    throw new Error('Couldn’t load bookings. Check your connection and try again.');
  }

  // Hand out copies, so nothing outside can edit the "database" by accident.
  return store.map(cloneBooking);
}

export async function updateBookingStatus(
  id: string,
  nextStatus: BookingStatus,
  declineReason: string | null,
): Promise<Booking> {
  await wait(config.delayMs);

  if (config.failUpdate || config.failUpdateIds.includes(id)) {
    throw new Error(`Server error while updating ${id}.`);
  }

  const current = store.find((booking) => booking.id === id);
  if (!current) {
    throw new Error(`Booking ${id} not found.`);
  }
  if (!canTransition(current.status, nextStatus)) {
    throw new Error(`Booking ${id} can’t move from ${current.status} to ${nextStatus}.`);
  }

  const reason = declineReason?.trim() ?? '';
  if (nextStatus === 'declined' && reason.length < DECLINE_REASON_MIN_LENGTH) {
    throw new Error(
      `A decline reason of at least ${DECLINE_REASON_MIN_LENGTH} characters is required.`,
    );
  }

  const updated: Booking = {
    ...current,
    status: nextStatus,
    declineReason: nextStatus === 'declined' ? reason : null,
  };
  store = store.map((booking) => (booking.id === id ? updated : booking));

  return cloneBooking(updated);
}

/** Resolves after `ms`. At 0 it resolves on the microtask queue, with no timer at all. */
function wait(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A copy deep enough for Booking: its only nested objects are renter and car. */
function cloneBooking(booking: Booking): Booking {
  return { ...booking, renter: { ...booking.renter }, car: { ...booking.car } };
}
