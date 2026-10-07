import { describe, expect, it } from 'vitest';
import { mockBookings } from '../data/bookings.mock';
import { bookingFacts } from './bookingFacts';

/** BK-1009 is the ID-pending booking: 3-day-old account, 0 trips, pickup 20 h out, 6 days. */
const pending = mockBookings.find((booking) => booking.id === 'BK-1009')!;

describe('bookingFacts', () => {
  it('lists the raw facts the rules look at, without a score', () => {
    expect(bookingFacts(pending)).toEqual([
      { label: 'ID check', value: 'Pending' },
      { label: 'Name on ID', value: 'Not known until the ID check returns' },
      { label: 'Payment', value: 'Credit card' },
      { label: 'Account age at booking', value: '3 days' },
      { label: 'Past trips', value: '0' },
      { label: 'Pickup', value: '20 hours after booking' },
      { label: 'Daily rate', value: '$130/day' },
      { label: 'Trip length', value: '6 days' },
    ]);
  });

  it('shows the name on the ID once the check has returned', () => {
    const checked = {
      ...pending,
      idCheck: 'passed' as const,
      renter: { ...pending.renter, nameOnId: 'Noor Haddad', pastTripCount: 1 },
      returnAt: new Date(new Date(pending.pickupAt).getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const facts = bookingFacts(checked);

    expect(facts).toContainEqual({ label: 'ID check', value: 'Passed' });
    expect(facts).toContainEqual({ label: 'Name on ID', value: 'Noor Haddad' });
    expect(facts).toContainEqual({ label: 'Past trips', value: '1' });
    expect(facts).toContainEqual({ label: 'Trip length', value: '1 day' });
  });
});
