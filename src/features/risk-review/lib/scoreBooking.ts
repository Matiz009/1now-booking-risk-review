import { daysBetween, minutesBetween } from '@/lib/datetime';
import { formatCurrency } from '@/lib/format';
import type { Booking, RiskLevel, RiskResult, RiskSignal } from '../types';
import { LEVEL_THRESHOLDS, MAX_SCORE, SIGNAL_POINTS, SIGNAL_THRESHOLDS } from './risk.config';

/**
 * Booking → risk result. Pure: no React, no clock, no side effects.
 *
 * Every signal is measured against the booking's own `createdAt`, never
 * against wall-clock now, so a booking's score is a fixed fact about the
 * moment it was placed and doesn't drift while it waits in the queue. That's
 * also why this function needs no `now` parameter to be deterministic.
 */
export function scoreBooking(booking: Booking): RiskResult {
  // Withhold judgment until the ID check returns, rather than show a partial
  // score an operator might act on.
  if (booking.idCheck === 'pending') {
    return { score: 0, level: 'unscored', signals: [] };
  }

  const signals = collectSignals(booking);
  const total = signals.reduce((sum, signal) => sum + signal.points, 0);
  const score = Math.min(total, MAX_SCORE);

  return { score, level: riskLevelFor(score), signals };
}

/** Score → level. Exported so the 29/30 and 59/60 edges can be tested directly. */
export function riskLevelFor(score: number): Exclude<RiskLevel, 'unscored'> {
  if (score >= LEVEL_THRESHOLDS.high) {
    return 'high';
  }
  if (score >= LEVEL_THRESHOLDS.medium) {
    return 'medium';
  }
  return 'low';
}

/**
 * "Jordan Alcott" and " jordan  alcott " are the same name. Trims, collapses
 * runs of whitespace and ignores case. Anything else, such as an initial, a
 * hyphenated surname or a missing suffix, still counts as a mismatch, because
 * that's exactly what an operator should look at.
 */
export function namesMatch(a: string, b: string): boolean {
  return normaliseName(a) === normaliseName(b);
}

function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Only the signals that fired, highest points first. */
function collectSignals(booking: Booking): RiskSignal[] {
  const { renter, car } = booking;
  const createdAt = new Date(booking.createdAt);
  const pickupAt = new Date(booking.pickupAt);
  const returnAt = new Date(booking.returnAt);

  const accountAgeDays = daysBetween(new Date(renter.accountCreatedAt), createdAt);
  const leadMinutes = minutesBetween(createdAt, pickupAt);
  const tripDays = daysBetween(pickupAt, returnAt);

  const signals: RiskSignal[] = [];

  if (booking.idCheck === 'failed') {
    signals.push({
      id: 'id_check_failed',
      label: 'ID check failed',
      points: SIGNAL_POINTS.id_check_failed,
      detail: 'The ID verification came back as failed',
    });
  }

  if (renter.nameOnId !== null && !namesMatch(renter.nameOnId, renter.fullName)) {
    signals.push({
      id: 'name_mismatch',
      label: 'Name on ID doesn’t match driver',
      points: SIGNAL_POINTS.name_mismatch,
      detail: `ID says “${renter.nameOnId}”, booking says “${renter.fullName}”`,
    });
  }

  if (booking.paymentType === 'prepaid_card') {
    signals.push({
      id: 'prepaid_card',
      label: 'Prepaid card',
      points: SIGNAL_POINTS.prepaid_card,
      detail: 'Paid with a prepaid card',
    });
  }

  if (accountAgeDays < SIGNAL_THRESHOLDS.newAccountDays) {
    signals.push({
      id: 'new_account',
      label: `Account under ${SIGNAL_THRESHOLDS.newAccountDays} days old`,
      points: SIGNAL_POINTS.new_account,
      detail: `Account created ${describeDays(accountAgeDays)} before booking`,
    });
  }

  if (renter.pastTripCount === 0) {
    signals.push({
      id: 'first_time_renter',
      label: 'First-time renter',
      points: SIGNAL_POINTS.first_time_renter,
      detail: 'No completed trips',
    });
  }

  if (leadMinutes < SIGNAL_THRESHOLDS.shortLeadMinutes) {
    signals.push({
      id: 'short_lead_time',
      label: `Pickup under ${SIGNAL_THRESHOLDS.shortLeadMinutes / 60} hours after booking`,
      points: SIGNAL_POINTS.short_lead_time,
      detail: `Pickup ${describeMinutes(leadMinutes)} after booking`,
    });
  }

  if (car.dailyRate >= SIGNAL_THRESHOLDS.highValueDailyRate) {
    signals.push({
      id: 'high_value_car',
      label: `High-value car (${formatCurrency(SIGNAL_THRESHOLDS.highValueDailyRate)}+/day)`,
      points: SIGNAL_POINTS.high_value_car,
      detail: `${car.year} ${car.make} ${car.model} at ${formatCurrency(car.dailyRate)}/day`,
    });
  }

  if (tripDays > SIGNAL_THRESHOLDS.longTripDays) {
    signals.push({
      id: 'long_trip',
      label: `Trip longer than ${SIGNAL_THRESHOLDS.longTripDays} days`,
      points: SIGNAL_POINTS.long_trip,
      detail: `${Math.floor(tripDays)}-day trip`,
    });
  }

  // `sort` is stable, so signals with equal points keep the order above.
  return signals.sort((a, b) => b.points - a.points);
}

/** 1 → "1 day", 2.6 → "2 days", 0.4 → "less than a day". */
function describeDays(days: number): string {
  const whole = Math.floor(days);
  if (whole < 1) {
    return 'less than a day';
  }
  return whole === 1 ? '1 day' : `${whole} days`;
}

/** 45 → "45 minutes", 90 → "1.5 hours", 120 → "2 hours". */
function describeMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} minutes`;
  }
  const hours = Math.round((minutes / 60) * 10) / 10;
  return hours === 1 ? '1 hour' : `${hours} hours`;
}
