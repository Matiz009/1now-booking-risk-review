import { describe, expect, it } from 'vitest';
import { addMinutes } from '@/lib/datetime';
import type { Booking } from '../types';
import { scoreBooking } from './scoreBooking';

/**
 * QA additions (TEST_CASES.md RS-13, RS-15, RS-19, RS-23). Written from the
 * spec in CLAUDE.md, with expected points as literals.
 */

const createdAt = new Date('2026-10-07T12:00:00.000Z');
const MINUTES_PER_DAY = 24 * 60;

type Overrides = {
  idCheck?: Booking['idCheck'];
  paymentType?: Booking['paymentType'];
  nameOnId?: string | null;
  accountAgeMinutes?: number;
  pastTripCount?: number;
  leadMinutes?: number;
  tripMinutes?: number;
  dailyRate?: number;
};

/** A booking where no signal fires, with the given facts changed. */
function booking(overrides: Overrides = {}): Booking {
  const {
    idCheck = 'passed',
    paymentType = 'credit_card',
    nameOnId = 'Sam Okafor',
    accountAgeMinutes = 400 * MINUTES_PER_DAY,
    pastTripCount = 3,
    leadMinutes = 2 * MINUTES_PER_DAY,
    tripMinutes = 3 * MINUTES_PER_DAY,
    dailyRate = 90,
  } = overrides;
  const pickupAt = addMinutes(createdAt, leadMinutes);
  return {
    id: 'BK-QA',
    createdAt: createdAt.toISOString(),
    pickupAt: pickupAt.toISOString(),
    returnAt: addMinutes(pickupAt, tripMinutes).toISOString(),
    totalAmount: 270,
    status: 'needs_review',
    declineReason: null,
    decidedAt: null,
    idCheck,
    paymentType,
    renter: {
      id: 'R-QA',
      fullName: 'Sam Okafor',
      nameOnId,
      accountCreatedAt: addMinutes(createdAt, -accountAgeMinutes).toISOString(),
      pastTripCount,
    },
    car: { id: 'CAR-QA', make: 'Kia', model: 'Niro', year: 2024, dailyRate },
  };
}

function signal(b: Booking, id: string) {
  return scoreBooking(b).signals.find((s) => s.id === id);
}

describe('RS-13: trip length on part days', () => {
  it('fires for any trip longer than 14 days, even by one minute', () => {
    expect(signal(booking({ tripMinutes: 14 * MINUTES_PER_DAY + 1 }), 'long_trip')).toBeDefined();
    expect(
      signal(booking({ tripMinutes: 14 * MINUTES_PER_DAY + 12 * 60 }), 'long_trip'),
    ).toBeDefined();
  });

  // Was a bug: a 14.5-day trip's evidence read "14-day trip", contradicting the rule.
  it('gives evidence that does not contradict the rule label', () => {
    const fired = signal(booking({ tripMinutes: 14 * MINUTES_PER_DAY + 12 * 60 }), 'long_trip');
    expect(fired?.label).toBe('Trip longer than 14 days');
    expect(fired?.detail).not.toBe('14-day trip');
    expect(fired?.detail).toBe('Trip of 14 days 12 h');
  });

  it('shows even one minute over 14 days in the evidence', () => {
    const fired = signal(booking({ tripMinutes: 14 * MINUTES_PER_DAY + 1 }), 'long_trip');
    expect(fired?.detail).toBe('Trip of 14 days 1 min');
  });
});

describe('RS-15: no name mismatch while the name on the ID is unknown', () => {
  it('does not compare names when nameOnId is null, even after a failed check', () => {
    expect(signal(booking({ idCheck: 'failed', nameOnId: null }), 'name_mismatch')).toBeUndefined();
    expect(signal(booking({ idCheck: 'passed', nameOnId: null }), 'name_mismatch')).toBeUndefined();
  });
});

describe('RS-19: cap boundaries', () => {
  it('leaves a total of exactly 100 at 100', () => {
    // 40 + 25 + 15 + 15 + 5 = 100
    const result = scoreBooking(
      booking({
        idCheck: 'failed',
        nameOnId: 'Someone Else',
        paymentType: 'prepaid_card',
        accountAgeMinutes: MINUTES_PER_DAY,
        tripMinutes: 20 * MINUTES_PER_DAY,
      }),
    );
    expect(result.signals).toHaveLength(5);
    expect(result.score).toBe(100);
    expect(result.level).toBe('high');
  });

  it('caps 125 at 100 and still lists every signal', () => {
    // Everything except the long trip: 130 − 5 = 125
    const result = scoreBooking(
      booking({
        idCheck: 'failed',
        nameOnId: 'Someone Else',
        paymentType: 'prepaid_card',
        accountAgeMinutes: MINUTES_PER_DAY,
        pastTripCount: 0,
        leadMinutes: 60,
        dailyRate: 300,
      }),
    );
    expect(result.signals.reduce((sum, s) => sum + s.points, 0)).toBe(125);
    expect(result.signals).toHaveLength(7);
    expect(result.score).toBe(100);
  });
});

describe('RS-23: evidence for every signal', () => {
  it.each([
    [{ idCheck: 'failed' as const }, 'id_check_failed', 'The ID verification came back as failed'],
    [{ nameOnId: 'S. Okafor' }, 'name_mismatch', 'ID says “S. Okafor”, booking says “Sam Okafor”'],
    [{ paymentType: 'prepaid_card' as const }, 'prepaid_card', 'Paid with a prepaid card'],
    [{ pastTripCount: 0 }, 'first_time_renter', 'No completed trips'],
    [{ tripMinutes: 21 * MINUTES_PER_DAY }, 'long_trip', 'Trip of 21 days'],
    [{ dailyRate: 150 }, 'high_value_car', '2024 Kia Niro at $150/day'],
  ])('%o → %s: "%s"', (overrides, id, detail) => {
    expect(signal(booking(overrides), id)?.detail).toBe(detail);
  });

  it('describes an account opened less than a day before booking', () => {
    expect(signal(booking({ accountAgeMinutes: 12 * 60 }), 'new_account')?.detail).toBe(
      'Account created less than a day before booking',
    );
    expect(
      signal(booking({ accountAgeMinutes: 1.5 * MINUTES_PER_DAY }), 'new_account')?.detail,
    ).toBe('Account created 1 day before booking');
  });

  it('describes a pickup under an hour after booking in minutes, and exactly 1 hour', () => {
    expect(signal(booking({ leadMinutes: 45 }), 'short_lead_time')?.detail).toBe(
      'Pickup 45 minutes after booking',
    );
    expect(signal(booking({ leadMinutes: 60 }), 'short_lead_time')?.detail).toBe(
      'Pickup 1 hour after booking',
    );
  });

  it('labels each signal the way the spec names it', () => {
    const all = scoreBooking(
      booking({
        idCheck: 'failed',
        nameOnId: 'Someone Else',
        paymentType: 'prepaid_card',
        accountAgeMinutes: MINUTES_PER_DAY,
        pastTripCount: 0,
        leadMinutes: 60,
        dailyRate: 300,
        tripMinutes: 20 * MINUTES_PER_DAY,
      }),
    );
    expect(all.signals.map((s) => [s.label, s.points])).toEqual([
      ['ID check failed', 40],
      ['Name on ID doesn’t match driver', 25],
      ['Prepaid card', 15],
      ['Account under 7 days old', 15],
      ['First-time renter', 10],
      ['Pickup under 3 hours after booking', 10],
      ['High-value car ($150+/day)', 10],
      ['Trip longer than 14 days', 5],
    ]);
  });
});
