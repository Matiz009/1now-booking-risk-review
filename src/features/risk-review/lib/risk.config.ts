import type { RiskSignalId } from '../types';

/**
 * Every number the risk engine uses, in one place (CLAUDE.md rule 5).
 *
 * The tests deliberately repeat these values as literals rather than importing
 * them. Change a weight here and the tests that depend on it fail, which is
 * the point: the tests are the spec, and this file is the implementation.
 */

/** Points each signal adds to the score when it fires. */
export const SIGNAL_POINTS: Record<RiskSignalId, number> = {
  id_check_failed: 40,
  name_mismatch: 25,
  prepaid_card: 15,
  new_account: 15,
  first_time_renter: 10,
  short_lead_time: 10,
  high_value_car: 10,
  long_trip: 5,
};

/** Where each signal's edge sits. Comments state which side of the edge fires. */
export const SIGNAL_THRESHOLDS = {
  /** Fires when the account is strictly younger than this at booking time. */
  newAccountDays: 7,
  /** Fires when pickup is strictly sooner than this after booking. */
  shortLeadMinutes: 180,
  /** Fires when the daily rate is at or above this. Whole dollars. */
  highValueDailyRate: 150,
  /** Fires when the trip is strictly longer than this. */
  longTripDays: 14,
};

/** The score never goes above this, however many signals fire. */
export const MAX_SCORE = 100;

/** A score at or above each value reaches that level. Below `medium` is low. */
export const LEVEL_THRESHOLDS = {
  medium: 30,
  high: 60,
};

/** A score at or above each value gets that recommendation. Below `verify` is approve. */
export const RECOMMENDATION_THRESHOLDS = {
  verify: 30,
  decline: 85,
};

/** An operator's decline reason must be at least this many characters. */
export const DECLINE_REASON_MIN_LENGTH = 10;
