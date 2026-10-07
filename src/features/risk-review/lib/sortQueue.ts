import type { ScoredBooking } from '../types';

/**
 * The order the operator works through a tab. Pure, and returns a new array.
 *
 *   1. Unscored first: an ID check is pending, so someone has to chase it.
 *   2. Then highest score first.
 *   3. Then earliest pickup first, as the soonest decision.
 *   4. Then booking id, so equal bookings never swap places between renders.
 */
export function sortQueue(items: readonly ScoredBooking[]): ScoredBooking[] {
  return [...items].sort(compareForQueue);
}

function compareForQueue(a: ScoredBooking, b: ScoredBooking): number {
  const aUnscored = a.risk.level === 'unscored';
  const bUnscored = b.risk.level === 'unscored';
  if (aUnscored !== bUnscored) {
    return aUnscored ? -1 : 1;
  }

  if (a.risk.score !== b.risk.score) {
    return b.risk.score - a.risk.score;
  }

  const pickupDifference =
    new Date(a.booking.pickupAt).getTime() - new Date(b.booking.pickupAt).getTime();
  if (pickupDifference !== 0) {
    return pickupDifference;
  }

  return a.booking.id.localeCompare(b.booking.id);
}
