import { daysBetween, minutesBetween } from '@/lib/datetime';
import { formatCurrency } from '@/lib/format';
import type { Booking, IdCheckStatus, PaymentType } from '../types';
import { describeDays, describeMinutes } from './scoreBooking';

/** One row of evidence, e.g. { label: 'Past trips', value: '0' }. */
export type BookingFact = {
  label: string;
  value: string;
};

const ID_CHECK_LABELS: Record<IdCheckStatus, string> = {
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Failed',
};

const PAYMENT_LABELS: Record<PaymentType, string> = {
  credit_card: 'Credit card',
  debit_card: 'Debit card',
  prepaid_card: 'Prepaid card',
};

/**
 * Booking → the raw facts the risk rules look at, without judging them. Pure.
 *
 * Shown instead of a score while the ID check is pending, so the operator can
 * see what's known without being handed a partial number to act on. Like
 * scoreBooking, everything is measured against the booking's createdAt.
 */
export function bookingFacts(booking: Booking): BookingFact[] {
  const { renter, car } = booking;
  const createdAt = new Date(booking.createdAt);
  const pickupAt = new Date(booking.pickupAt);

  const accountAgeDays = daysBetween(new Date(renter.accountCreatedAt), createdAt);
  const leadMinutes = minutesBetween(createdAt, pickupAt);
  const tripDays = Math.floor(daysBetween(pickupAt, new Date(booking.returnAt)));

  return [
    { label: 'ID check', value: ID_CHECK_LABELS[booking.idCheck] },
    { label: 'Name on ID', value: renter.nameOnId ?? 'Not known until the ID check returns' },
    { label: 'Payment', value: PAYMENT_LABELS[booking.paymentType] },
    { label: 'Account age at booking', value: describeDays(accountAgeDays) },
    { label: 'Past trips', value: String(renter.pastTripCount) },
    { label: 'Pickup', value: `${describeMinutes(leadMinutes)} after booking` },
    { label: 'Daily rate', value: `${formatCurrency(car.dailyRate)}/day` },
    { label: 'Trip length', value: tripDays === 1 ? '1 day' : `${tripDays} days` },
  ];
}
