import { describe, expect, it } from 'vitest';
import { mockBookings } from './bookings.mock';
import { daysBetween } from '@/lib/datetime';
import type { BookingStatus, IdCheckStatus } from '../types';

/**
 * These assert the shape and coverage of the fixture set. The expected *scores*
 * are asserted separately in scoreBooking.test.ts, once the scorer exists.
 */

describe('mockBookings', () => {
  it('has twelve bookings with unique ids', () => {
    expect(mockBookings).toHaveLength(12);
    expect(new Set(mockBookings.map((b) => b.id)).size).toBe(12);
  });

  it('covers every booking status', () => {
    const statuses: BookingStatus[] = [
      'needs_review',
      'verification_requested',
      'approved',
      'declined',
    ];
    const present = new Set(mockBookings.map((b) => b.status));

    for (const status of statuses) {
      expect(present, `missing a booking with status ${status}`).toContain(status);
    }
  });

  it('covers every ID check outcome', () => {
    const outcomes: IdCheckStatus[] = ['pending', 'passed', 'failed'];
    const present = new Set(mockBookings.map((b) => b.idCheck));

    for (const outcome of outcomes) {
      expect(present, `missing a booking with idCheck ${outcome}`).toContain(outcome);
    }
  });

  it('stores a decline reason on exactly the declined bookings', () => {
    for (const booking of mockBookings) {
      if (booking.status === 'declined') {
        expect(booking.declineReason, `${booking.id} is declined without a reason`).not.toBeNull();
        expect(booking.declineReason?.length ?? 0).toBeGreaterThanOrEqual(10);
      } else {
        expect(booking.declineReason, `${booking.id} has a stray decline reason`).toBeNull();
      }
    }
  });

  it('stores a decision time on exactly the final bookings', () => {
    for (const booking of mockBookings) {
      const isFinal = booking.status === 'approved' || booking.status === 'declined';
      expect(booking.decidedAt !== null, `${booking.id}: decidedAt`).toBe(isFinal);
    }
  });

  it('leaves nameOnId null exactly while the ID check is pending', () => {
    for (const booking of mockBookings) {
      const expectation = booking.idCheck === 'pending' ? 'to be null' : 'to be set';
      const isNull = booking.renter.nameOnId === null;
      expect(isNull, `${booking.id}: expected nameOnId ${expectation}`).toBe(
        booking.idCheck === 'pending',
      );
    }
  });

  it('orders each booking account → created → pickup → return', () => {
    for (const booking of mockBookings) {
      const accountCreated = new Date(booking.renter.accountCreatedAt);
      const created = new Date(booking.createdAt);
      const pickup = new Date(booking.pickupAt);
      const returned = new Date(booking.returnAt);

      expect(accountCreated.getTime(), `${booking.id} account`).toBeLessThan(created.getTime());
      expect(created.getTime(), `${booking.id} pickup`).toBeLessThan(pickup.getTime());
      expect(pickup.getTime(), `${booking.id} return`).toBeLessThan(returned.getTime());
    }
  });

  it('charges the daily rate for every whole day of the trip', () => {
    for (const booking of mockBookings) {
      const tripDays = daysBetween(new Date(booking.pickupAt), new Date(booking.returnAt));
      expect(booking.totalAmount, `${booking.id} total`).toBe(booking.car.dailyRate * tripDays);
    }
  });

  /**
   * The point of this one: if someone replaces the relative date arithmetic
   * with hard-coded ISO strings, this fails the following week rather than
   * silently making "pickup in 2 hours" a lie during the demo.
   */
  it('builds dates relative to the current time, not fixed strings', () => {
    const now = new Date();

    for (const booking of mockBookings) {
      const bookedDaysAgo = daysBetween(new Date(booking.createdAt), now);
      expect(bookedDaysAgo, `${booking.id} was booked too long ago to be relative`).toBeLessThan(3);
      expect(bookedDaysAgo, `${booking.id} was booked in the future`).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps every pickup in the future so lead times stay meaningful', () => {
    const now = new Date();
    const upcoming = mockBookings.filter((b) => b.status !== 'declined');

    for (const booking of upcoming) {
      expect(new Date(booking.pickupAt).getTime(), `${booking.id} pickup`).toBeGreaterThan(
        now.getTime(),
      );
    }
  });
});
