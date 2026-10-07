import type { BookingStatus, Recommendation, RiskResult } from '../types';
import { RECOMMENDATION_THRESHOLDS } from './risk.config';

/**
 * Risk result → recommended action. Pure.
 *
 * This is advice, not an action: the operator can always override it. The
 * rules are checked in priority order, and the first match wins:
 *
 *   1. unscored (ID check pending)  → wait for ID; the UI disables Approve
 *   2. ID check failed, or ≥ 85     → decline
 *   3. ≥ 30                         → request verification (+ deposit if high)
 *   4. otherwise                    → approve
 *
 * Everything it needs is on the RiskResult: `unscored` encodes "pending", and
 * a failed ID check is one of the signals, so no Booking parameter is needed.
 */
export function recommendAction(risk: RiskResult): Recommendation {
  if (risk.level === 'unscored') {
    return {
      action: 'wait_for_id',
      headline: 'Wait for ID check',
      rationale: 'The ID check hasn’t returned yet, so this booking can’t be scored or approved.',
    };
  }

  const idCheckFailed = risk.signals.some((signal) => signal.id === 'id_check_failed');

  if (idCheckFailed) {
    return {
      action: 'decline',
      headline: 'Decline',
      rationale: 'The renter’s ID check failed.',
    };
  }

  if (risk.score >= RECOMMENDATION_THRESHOLDS.decline) {
    return {
      action: 'decline',
      headline: 'Decline',
      rationale: `A score of ${risk.score} is at or above the decline threshold of ${RECOMMENDATION_THRESHOLDS.decline}.`,
    };
  }

  if (risk.score >= RECOMMENDATION_THRESHOLDS.verify) {
    const rationale =
      risk.level === 'high'
        ? 'High risk: ask the renter to verify their identity and consider taking a higher deposit.'
        : 'Medium risk: ask the renter to verify their identity before approving.';

    return { action: 'request_verification', headline: 'Request verification', rationale };
  }

  // Low risk can still have a signal or two; say so rather than contradict
  // the list the operator is looking at.
  const count = risk.signals.length;
  const rationale =
    count === 0
      ? 'Low risk: nothing here needs a second look.'
      : `Low risk. ${count === 1 ? 'One signal' : `${count} signals`} to glance at; fine to approve.`;

  return { action: 'approve', headline: 'Approve', rationale };
}

/**
 * Fits the risk-based recommendation to where the booking is now. Pure.
 *
 *   needs_review           → the recommendation as is
 *   verification_requested → wait for the renter (but an ID check still
 *                            pending keeps its own advice, and Approve stays blocked)
 *   approved / declined    → null: the decision is made, there's nothing to suggest
 */
export function recommendationForStatus(
  status: BookingStatus,
  recommendation: Recommendation,
): Recommendation | null {
  switch (status) {
    case 'needs_review':
      return recommendation;
    case 'verification_requested':
      if (recommendation.action === 'wait_for_id') {
        return recommendation;
      }
      return {
        action: 'wait_for_renter',
        headline: 'Waiting on the renter',
        rationale: 'Approve once they’re verified, or decline.',
      };
    case 'approved':
    case 'declined':
      return null;
  }
}

/**
 * Why Approve is unavailable, or null when it's allowed. Only one rule today:
 * a booking waiting on its ID check can't be approved (CLAUDE.md). The
 * operator can still request verification or decline.
 */
export function approveBlockedReason(recommendation: Recommendation): string | null {
  if (recommendation.action === 'wait_for_id') {
    return 'Approve is unavailable until the ID check returns.';
  }
  return null;
}
