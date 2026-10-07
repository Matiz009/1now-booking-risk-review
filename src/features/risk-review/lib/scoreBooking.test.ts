import { describe, expect, it } from 'vitest';
import { addDays, addMinutes } from '@/lib/datetime';
import { mockBookings } from '../data/bookings.mock';
import type { Booking, RecommendedAction, RiskLevel, RiskSignalId } from '../types';
import { recommendAction } from './recommendAction';
import { namesMatch, riskLevelFor, scoreBooking } from './scoreBooking';

/**
 * Expected points are written as literals, not imported from risk.config.ts.
 * If someone changes a weight, these tests should fail; that's the point.
 */

// A fixed instant, so every booking built here is identical on every run.
const createdAt = new Date('2026-10-07T12:00:00.000Z');

type BookingOptions = {
  idCheck?: Booking['idCheck'];
  paymentType?: Booking['paymentType'];
  fullName?: string;
  nameOnId?: string | null;
  accountAgeMinutes?: number;
  pastTripCount?: number;
  leadMinutes?: number;
  tripMinutes?: number;
  dailyRate?: number;
};

const MINUTES_PER_DAY = 24 * 60;

/**
 * Builds a booking where no signal fires, then applies the overrides. Durations
 * are in minutes so the edge tests can land exactly on, or one unit off, a
 * threshold.
 */
function makeBooking(options: BookingOptions = {}): Booking {
  const {
    idCheck = 'passed',
    paymentType = 'credit_card',
    fullName = 'Dana Whitfield',
    nameOnId = fullName,
    accountAgeMinutes = 365 * MINUTES_PER_DAY,
    pastTripCount = 5,
    leadMinutes = 3 * MINUTES_PER_DAY,
    tripMinutes = 3 * MINUTES_PER_DAY,
    dailyRate = 80,
  } = options;

  const pickupAt = addMinutes(createdAt, leadMinutes);

  return {
    id: 'BK-TEST',
    createdAt: createdAt.toISOString(),
    pickupAt: pickupAt.toISOString(),
    returnAt: addMinutes(pickupAt, tripMinutes).toISOString(),
    totalAmount: 240,
    status: 'needs_review',
    declineReason: null,
    idCheck,
    paymentType,
    renter: {
      id: 'R-TEST',
      fullName,
      nameOnId,
      accountCreatedAt: addMinutes(createdAt, -accountAgeMinutes).toISOString(),
      pastTripCount,
    },
    car: { id: 'CAR-TEST', make: 'Toyota', model: 'Corolla', year: 2022, dailyRate },
  };
}

function firedIds(booking: Booking): RiskSignalId[] {
  return scoreBooking(booking).signals.map((signal) => signal.id);
}

describe('scoreBooking: baseline', () => {
  it('scores a clean booking 0, low, with no signals', () => {
    expect(scoreBooking(makeBooking())).toEqual({ score: 0, level: 'low', signals: [] });
  });
});

describe('scoreBooking: each signal on its own', () => {
  const cases: { name: string; booking: Booking; id: RiskSignalId; points: number }[] = [
    {
      name: 'ID check failed',
      booking: makeBooking({ idCheck: 'failed' }),
      id: 'id_check_failed',
      points: 40,
    },
    {
      name: 'name mismatch',
      booking: makeBooking({ nameOnId: 'D. Whitfield' }),
      id: 'name_mismatch',
      points: 25,
    },
    {
      name: 'prepaid card',
      booking: makeBooking({ paymentType: 'prepaid_card' }),
      id: 'prepaid_card',
      points: 15,
    },
    {
      name: 'new account',
      booking: makeBooking({ accountAgeMinutes: 2 * MINUTES_PER_DAY }),
      id: 'new_account',
      points: 15,
    },
    {
      name: 'first-time renter',
      booking: makeBooking({ pastTripCount: 0 }),
      id: 'first_time_renter',
      points: 10,
    },
    {
      name: 'short lead time',
      booking: makeBooking({ leadMinutes: 90 }),
      id: 'short_lead_time',
      points: 10,
    },
    {
      name: 'high-value car',
      booking: makeBooking({ dailyRate: 200 }),
      id: 'high_value_car',
      points: 10,
    },
    {
      name: 'long trip',
      booking: makeBooking({ tripMinutes: 21 * MINUTES_PER_DAY }),
      id: 'long_trip',
      points: 5,
    },
  ];

  it.each(cases)('$name adds $points points and nothing else', ({ booking, id, points }) => {
    const result = scoreBooking(booking);

    expect(result.score).toBe(points);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]).toMatchObject({ id, points });
  });

  it('does not count a debit card as prepaid', () => {
    expect(firedIds(makeBooking({ paymentType: 'debit_card' }))).toEqual([]);
  });

  it('does not flag a renter with one past trip as first-time', () => {
    expect(firedIds(makeBooking({ pastTripCount: 1 }))).toEqual([]);
  });

  it('attaches the evidence for this booking to each signal', () => {
    const result = scoreBooking(
      makeBooking({ leadMinutes: 90, accountAgeMinutes: 2 * MINUTES_PER_DAY, dailyRate: 180 }),
    );
    const details = Object.fromEntries(result.signals.map((s) => [s.id, s.detail]));

    expect(details.short_lead_time).toBe('Pickup 1.5 hours after booking');
    expect(details.new_account).toBe('Account created 2 days before booking');
    expect(details.high_value_car).toBe('2022 Toyota Corolla at $180/day');
  });
});

describe('scoreBooking: signal edges', () => {
  it('lead time: 179 minutes is flagged, 180 is not', () => {
    expect(firedIds(makeBooking({ leadMinutes: 179 }))).toEqual(['short_lead_time']);
    expect(firedIds(makeBooking({ leadMinutes: 180 }))).toEqual([]);
  });

  it('account age: just under 7 days is flagged, exactly 7 days is not', () => {
    expect(firedIds(makeBooking({ accountAgeMinutes: 7 * MINUTES_PER_DAY - 1 }))).toEqual([
      'new_account',
    ]);
    expect(firedIds(makeBooking({ accountAgeMinutes: 7 * MINUTES_PER_DAY }))).toEqual([]);
  });

  it('trip length: 15 days is flagged, exactly 14 days is not', () => {
    expect(firedIds(makeBooking({ tripMinutes: 15 * MINUTES_PER_DAY }))).toEqual(['long_trip']);
    expect(firedIds(makeBooking({ tripMinutes: 14 * MINUTES_PER_DAY }))).toEqual([]);
  });

  it('daily rate: $149 is not flagged, $150 is', () => {
    expect(firedIds(makeBooking({ dailyRate: 149 }))).toEqual([]);
    expect(firedIds(makeBooking({ dailyRate: 150 }))).toEqual(['high_value_car']);
  });
});

describe('scoreBooking: name matching', () => {
  it('ignores case and surrounding or repeated whitespace', () => {
    const booking = makeBooking({ fullName: 'Jordan Alcott', nameOnId: 'jordan alcott ' });
    expect(firedIds(booking)).toEqual([]);

    expect(namesMatch('Jordan Alcott', '  JORDAN   ALCOTT')).toBe(true);
  });

  it('still flags initials, extra surnames and other real differences', () => {
    expect(namesMatch('Jordan Alcott', 'J. Alcott')).toBe(false);
    expect(namesMatch('Jordan Alcott', 'Jordan Alcott-Reyes')).toBe(false);
    expect(namesMatch('Jordan Alcott', 'Jordon Alcott')).toBe(false);
  });
});

describe('scoreBooking: totals, cap and ordering', () => {
  const everything = makeBooking({
    idCheck: 'failed',
    nameOnId: 'Someone Else',
    paymentType: 'prepaid_card',
    accountAgeMinutes: MINUTES_PER_DAY,
    pastTripCount: 0,
    leadMinutes: 60,
    dailyRate: 300,
    tripMinutes: 20 * MINUTES_PER_DAY,
  });

  it('adds the points of every signal that fires', () => {
    // prepaid 15 + first-time 10 + high-value 10 = 35
    const result = scoreBooking(
      makeBooking({ paymentType: 'prepaid_card', pastTripCount: 0, dailyRate: 165 }),
    );
    expect(result.score).toBe(35);
    expect(result.level).toBe('medium');
  });

  it('caps the score at 100 when all eight signals fire (130 raw)', () => {
    const result = scoreBooking(everything);

    expect(result.signals).toHaveLength(8);
    expect(result.score).toBe(100);
    expect(result.level).toBe('high');
  });

  it('lists signals highest points first, ties in rule order', () => {
    expect(firedIds(everything)).toEqual([
      'id_check_failed',
      'name_mismatch',
      'prepaid_card',
      'new_account',
      'first_time_renter',
      'short_lead_time',
      'high_value_car',
      'long_trip',
    ]);
  });
});

describe('scoreBooking: unscored', () => {
  it('withholds a score while the ID check is pending, even if signals would fire', () => {
    const booking = makeBooking({
      idCheck: 'pending',
      nameOnId: null,
      paymentType: 'prepaid_card',
      pastTripCount: 0,
      accountAgeMinutes: MINUTES_PER_DAY,
    });

    expect(scoreBooking(booking)).toEqual({ score: 0, level: 'unscored', signals: [] });
  });
});

describe('scoreBooking: does not depend on the current time', () => {
  it('gives the same result for the same booking scored later', () => {
    // Shifting every timestamp forward a month leaves all durations the same.
    const booking = makeBooking({ leadMinutes: 120, accountAgeMinutes: MINUTES_PER_DAY });
    const later: Booking = {
      ...booking,
      createdAt: addDays(new Date(booking.createdAt), 30).toISOString(),
      pickupAt: addDays(new Date(booking.pickupAt), 30).toISOString(),
      returnAt: addDays(new Date(booking.returnAt), 30).toISOString(),
      renter: {
        ...booking.renter,
        accountCreatedAt: addDays(new Date(booking.renter.accountCreatedAt), 30).toISOString(),
      },
    };

    expect(scoreBooking(later)).toEqual(scoreBooking(booking));
  });
});

describe('riskLevelFor: level boundaries', () => {
  it.each<[number, RiskLevel]>([
    [0, 'low'],
    [29, 'low'],
    [30, 'medium'],
    [59, 'medium'],
    [60, 'high'],
    [100, 'high'],
  ])('%i → %s', (score, level) => {
    expect(riskLevelFor(score)).toBe(level);
  });
});

/**
 * The plan's table of 12 mock bookings, asserted against the real scorer and
 * recommender. The comments in bookings.mock.ts are a reading aid; this is the
 * check that keeps them honest.
 */
describe('the 12 mock bookings', () => {
  const expected: {
    id: string;
    score: number;
    level: RiskLevel;
    action: RecommendedAction;
    signals: RiskSignalId[];
  }[] = [
    { id: 'BK-1001', score: 0, level: 'low', action: 'approve', signals: [] },
    { id: 'BK-1002', score: 10, level: 'low', action: 'approve', signals: ['first_time_renter'] },
    { id: 'BK-1003', score: 10, level: 'low', action: 'approve', signals: ['high_value_car'] },
    { id: 'BK-1004', score: 25, level: 'low', action: 'approve', signals: ['name_mismatch'] },
    {
      id: 'BK-1005',
      score: 35,
      level: 'medium',
      action: 'request_verification',
      signals: ['prepaid_card', 'first_time_renter', 'high_value_car'],
    },
    {
      id: 'BK-1006',
      score: 45,
      level: 'medium',
      action: 'request_verification',
      signals: ['new_account', 'first_time_renter', 'short_lead_time', 'high_value_car'],
    },
    {
      id: 'BK-1007',
      score: 65,
      level: 'high',
      action: 'request_verification',
      signals: ['name_mismatch', 'prepaid_card', 'new_account', 'first_time_renter'],
    },
    {
      id: 'BK-1008',
      score: 90,
      level: 'high',
      action: 'decline',
      signals: [
        'name_mismatch',
        'prepaid_card',
        'new_account',
        'first_time_renter',
        'short_lead_time',
        'high_value_car',
        'long_trip',
      ],
    },
    { id: 'BK-1009', score: 0, level: 'unscored', action: 'wait_for_id', signals: [] },
    {
      id: 'BK-1010',
      score: 100,
      level: 'high',
      action: 'decline',
      signals: [
        'id_check_failed',
        'name_mismatch',
        'prepaid_card',
        'new_account',
        'first_time_renter',
        'short_lead_time',
        'high_value_car',
        'long_trip',
      ],
    },
    { id: 'BK-1011', score: 0, level: 'low', action: 'approve', signals: [] },
    {
      id: 'BK-1012',
      score: 85,
      level: 'high',
      action: 'decline',
      signals: [
        'name_mismatch',
        'prepaid_card',
        'new_account',
        'first_time_renter',
        'short_lead_time',
        'high_value_car',
      ],
    },
  ];

  it('has an expectation for every mock booking', () => {
    expect(expected.map((e) => e.id)).toEqual(mockBookings.map((b) => b.id));
  });

  it.each(expected)('$id → $score, $level, $action', ({ id, score, level, action, signals }) => {
    const booking = mockBookings.find((b) => b.id === id);
    if (!booking) {
      throw new Error(`Mock booking ${id} not found`);
    }

    const risk = scoreBooking(booking);

    expect(risk.score).toBe(score);
    expect(risk.level).toBe(level);
    expect(risk.signals.map((s) => s.id)).toEqual(signals);
    expect(recommendAction(risk).action).toBe(action);
  });
});
