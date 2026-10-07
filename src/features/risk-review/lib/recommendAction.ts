import type { Recommendation, RiskResult } from '../types';
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

  return {
    action: 'approve',
    headline: 'Approve',
    rationale: 'Low risk: nothing here needs a second look.',
  };
}
