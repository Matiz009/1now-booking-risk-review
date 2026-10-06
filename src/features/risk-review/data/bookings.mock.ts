import { addDays, addMinutes } from '@/lib/datetime';
import type { Booking, BookingStatus, Car, IdCheckStatus, PaymentType } from '../types';

/**
 * Twelve mock bookings, one per case the review queue has to handle.
 *
 * Everything is built relative to a single `now` captured when this module
 * loads, so "pickup in 90 minutes" is still true tomorrow. The *scores*,
 * though, don't depend on `now` at all: every signal is measured against the
 * booking's own `createdAt` (account age at booking time, lead time
 * pickup − created, trip length return − pickup). A booking's risk is a fact
 * about the moment it was placed, and it must not drift as the booking ages in
 * the queue.
 */

const now = new Date();

const cars = {
  corolla: { id: 'CAR-01', make: 'Toyota', model: 'Corolla', year: 2022, dailyRate: 69 },
  civic: { id: 'CAR-02', make: 'Honda', model: 'Civic', year: 2023, dailyRate: 75 },
  threeSeries: { id: 'CAR-03', make: 'BMW', model: '330i', year: 2024, dailyRate: 180 },
  cx5: { id: 'CAR-04', make: 'Mazda', model: 'CX-5', year: 2023, dailyRate: 95 },
  a5: { id: 'CAR-05', make: 'Audi', model: 'A5', year: 2024, dailyRate: 165 },
  model3: { id: 'CAR-06', make: 'Tesla', model: 'Model 3', year: 2025, dailyRate: 210 },
  wrangler: { id: 'CAR-07', make: 'Jeep', model: 'Wrangler', year: 2023, dailyRate: 110 },
  macan: { id: 'CAR-08', make: 'Porsche', model: 'Macan', year: 2024, dailyRate: 260 },
  explorer: { id: 'CAR-09', make: 'Ford', model: 'Explorer', year: 2023, dailyRate: 130 },
  rangeRover: {
    id: 'CAR-10',
    make: 'Land Rover',
    model: 'Range Rover Sport',
    year: 2024,
    dailyRate: 295,
  },
  outback: { id: 'CAR-11', make: 'Subaru', model: 'Outback', year: 2022, dailyRate: 85 },
  c300: { id: 'CAR-12', make: 'Mercedes-Benz', model: 'C300', year: 2023, dailyRate: 190 },
} satisfies Record<string, Car>;

/**
 * The knobs that actually drive the risk signals. Writing seeds this way keeps
 * each booking readable as a row of facts instead of six computed ISO strings.
 */
type BookingSeed = {
  id: string;
  renterId: string;
  fullName: string;
  /** null while the ID check is pending; differs from fullName to trip the mismatch signal. */
  nameOnId: string | null;
  car: Car;
  idCheck: IdCheckStatus;
  paymentType: PaymentType;
  /** Age of the renter's account *at the moment of booking*. */
  accountAgeDays: number;
  pastTripCount: number;
  /** How long ago the booking was placed. Affects display only, never the score. */
  bookedMinutesAgo: number;
  /** pickupAt − createdAt. Under 180 trips the short-lead-time signal. */
  leadMinutes: number;
  tripDays: number;
  status: BookingStatus;
  declineReason?: string;
};

function buildBooking(seed: BookingSeed): Booking {
  const createdAt = addMinutes(now, -seed.bookedMinutesAgo);
  const pickupAt = addMinutes(createdAt, seed.leadMinutes);
  const returnAt = addDays(pickupAt, seed.tripDays);

  return {
    id: seed.id,
    createdAt: createdAt.toISOString(),
    pickupAt: pickupAt.toISOString(),
    returnAt: returnAt.toISOString(),
    totalAmount: seed.car.dailyRate * seed.tripDays,
    status: seed.status,
    declineReason: seed.declineReason ?? null,
    idCheck: seed.idCheck,
    paymentType: seed.paymentType,
    renter: {
      id: seed.renterId,
      fullName: seed.fullName,
      nameOnId: seed.nameOnId,
      accountCreatedAt: addDays(createdAt, -seed.accountAgeDays).toISOString(),
      pastTripCount: seed.pastTripCount,
    },
    car: seed.car,
  };
}

/**
 * Weights, for reading the comments below: ID failed 40 · name mismatch 25 ·
 * prepaid 15 · account < 7d 15 · 0 past trips 10 · pickup < 3h 10 ·
 * rate ≥ $150 10 · trip > 14d 5. Levels: low < 30 · medium 30–59 · high ≥ 60.
 *
 * The expected totals are asserted against the real scorer in
 * scoreBooking.test.ts — these comments are a reading aid, not the source of
 * truth, and they can't silently drift out of sync without a test failing.
 */
const seeds: BookingSeed[] = [
  // 1 — clean. Nothing fires. 0 → low → approve.
  {
    id: 'BK-1001',
    renterId: 'R-01',
    fullName: 'Dana Whitfield',
    nameOnId: 'Dana Whitfield',
    car: cars.corolla,
    idCheck: 'passed',
    paymentType: 'credit_card',
    accountAgeDays: 730,
    pastTripCount: 14,
    bookedMinutesAgo: 1800,
    leadMinutes: 8640, // 6 days
    tripDays: 3,
    status: 'needs_review',
  },

  // 2 — first-time renter only. 10 → low → approve.
  {
    id: 'BK-1002',
    renterId: 'R-02',
    fullName: 'Marcus Hale',
    nameOnId: 'Marcus Hale',
    car: cars.civic,
    idCheck: 'passed',
    paymentType: 'credit_card',
    accountAgeDays: 240,
    pastTripCount: 0,
    bookedMinutesAgo: 1560,
    leadMinutes: 2880, // 2 days
    tripDays: 4,
    status: 'needs_review',
  },

  // 3 — high-value car only. 10 → low → approve. An expensive car alone is
  //     not a red flag when the renter is established.
  {
    id: 'BK-1003',
    renterId: 'R-03',
    fullName: 'Priya Raman',
    nameOnId: 'Priya Raman',
    car: cars.threeSeries,
    idCheck: 'passed',
    paymentType: 'credit_card',
    accountAgeDays: 365,
    pastTripCount: 6,
    bookedMinutesAgo: 1200,
    leadMinutes: 2160, // 36 hours
    tripDays: 2,
    status: 'needs_review',
  },

  // 4 — name mismatch alone. 25 → still low. This is the case that proves the
  //     30-point threshold is a real boundary and not a feeling.
  {
    id: 'BK-1004',
    renterId: 'R-04',
    fullName: 'Ellis Brandt',
    nameOnId: 'Ellis R. Brandt',
    car: cars.cx5,
    idCheck: 'passed',
    paymentType: 'credit_card',
    accountAgeDays: 120,
    pastTripCount: 8,
    bookedMinutesAgo: 840,
    leadMinutes: 4320, // 3 days
    tripDays: 5,
    status: 'needs_review',
  },

  // 5 — prepaid 15 + first-time 10 + high-value 10 = 35 → medium.
  //     Carries the verification_requested status so every status in the union
  //     appears in the data.
  {
    id: 'BK-1005',
    renterId: 'R-05',
    fullName: 'Tovah Mercer',
    nameOnId: 'Tovah Mercer',
    car: cars.a5,
    idCheck: 'passed',
    paymentType: 'prepaid_card',
    accountAgeDays: 60,
    pastTripCount: 0,
    bookedMinutesAgo: 600,
    leadMinutes: 2880,
    tripDays: 3,
    status: 'verification_requested',
  },

  // 6 — new account 15 + first-time 10 + short lead 10 + high-value 10 = 45 → medium.
  {
    id: 'BK-1006',
    renterId: 'R-06',
    fullName: 'Kyle Ferreira',
    nameOnId: 'Kyle Ferreira',
    car: cars.model3,
    idCheck: 'passed',
    paymentType: 'credit_card',
    accountAgeDays: 2,
    pastTripCount: 0,
    bookedMinutesAgo: 45,
    leadMinutes: 120, // 2 hours
    tripDays: 3,
    status: 'needs_review',
  },

  // 7 — mismatch 25 + prepaid 15 + new account 15 + first-time 10 = 65 → high,
  //     but under 85, so the recommendation is verification with a higher
  //     deposit, not decline.
  {
    id: 'BK-1007',
    renterId: 'R-07',
    fullName: 'Jordan Alcott',
    nameOnId: 'J. Alcott-Reyes',
    car: cars.wrangler,
    idCheck: 'passed',
    paymentType: 'prepaid_card',
    accountAgeDays: 4,
    pastTripCount: 0,
    bookedMinutesAgo: 480,
    leadMinutes: 5760, // 4 days
    tripDays: 5,
    status: 'needs_review',
  },

  // 8 — mismatch 25 + prepaid 15 + new account 15 + first-time 10 + short lead
  //     10 + high-value 10 + long trip 5 = 90 → decline, on a *passing* ID
  //     check. Score alone can condemn a booking.
  {
    id: 'BK-1008',
    renterId: 'R-08',
    fullName: 'Ryan Kessel',
    nameOnId: 'Ryan Kessel-Moreau',
    car: cars.macan,
    idCheck: 'passed',
    paymentType: 'prepaid_card',
    accountAgeDays: 1,
    pastTripCount: 0,
    bookedMinutesAgo: 30,
    leadMinutes: 90, // 1.5 hours
    tripDays: 21,
    status: 'needs_review',
  },

  // 9 — ID check still running. Scored as `unscored`: no number, no signals,
  //     Approve disabled. Would otherwise have fired new account + first-time.
  {
    id: 'BK-1009',
    renterId: 'R-09',
    fullName: 'Noor Haddad',
    nameOnId: null,
    car: cars.explorer,
    idCheck: 'pending',
    paymentType: 'credit_card',
    accountAgeDays: 3,
    pastTripCount: 0,
    bookedMinutesAgo: 240,
    leadMinutes: 1200, // 20 hours
    tripDays: 6,
    status: 'needs_review',
  },

  // 10 — every one of the eight signals fires: 40 + 25 + 15 + 15 + 10 + 10 + 10
  //      + 5 = 130, capped to 100. Decline.
  {
    id: 'BK-1010',
    renterId: 'R-10',
    fullName: 'Victor Sandoval',
    nameOnId: 'Viktor Sandoval-Reyes',
    car: cars.rangeRover,
    idCheck: 'failed',
    paymentType: 'prepaid_card',
    accountAgeDays: 1,
    pastTripCount: 0,
    bookedMinutesAgo: 60,
    leadMinutes: 120, // 2 hours
    tripDays: 18,
    status: 'needs_review',
  },

  // 11 — already approved. 0 → low. Terminal: no actions available.
  {
    id: 'BK-1011',
    renterId: 'R-11',
    fullName: 'Amelia Choi',
    nameOnId: 'Amelia Choi',
    car: cars.outback,
    idCheck: 'passed',
    paymentType: 'credit_card',
    accountAgeDays: 1095,
    pastTripCount: 22,
    bookedMinutesAgo: 2880,
    leadMinutes: 10080, // 7 days
    tripDays: 4,
    status: 'approved',
  },

  // 12 — mismatch 25 + prepaid 15 + new account 15 + first-time 10 + short lead
  //      10 + high-value 10 = 85. Already declined, reason stored. Terminal.
  {
    id: 'BK-1012',
    renterId: 'R-12',
    fullName: 'Trent Yoakum',
    nameOnId: 'T. Yoakum Jr',
    car: cars.c300,
    idCheck: 'passed',
    paymentType: 'prepaid_card',
    accountAgeDays: 5,
    pastTripCount: 0,
    bookedMinutesAgo: 30,
    leadMinutes: 60, // 1 hour
    tripDays: 4,
    status: 'declined',
    declineReason:
      'Name on ID does not match the account holder and the card is prepaid. Asked for a bank card and a selfie; no response.',
  },
];

export const mockBookings: Booking[] = seeds.map(buildBooking);
