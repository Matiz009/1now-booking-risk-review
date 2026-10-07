import { describe, expect, it } from 'vitest';
import type { RiskResult, RiskSignal } from '../types';
import { approveBlockedReason, recommendAction, recommendationForStatus } from './recommendAction';
import { riskLevelFor } from './scoreBooking';

/**
 * Built straight from a score so the thresholds can be hit exactly. Real
 * weights are all multiples of 5, so a booking can never score 29 or 84.
 */
function riskWithScore(score: number, signals: RiskSignal[] = []): RiskResult {
  return { score, level: riskLevelFor(score), signals };
}

const idFailed: RiskSignal = {
  id: 'id_check_failed',
  label: 'ID check failed',
  points: 40,
  detail: 'The ID verification came back as failed',
};

describe('recommendAction', () => {
  it('waits for the ID check when the booking is unscored', () => {
    const recommendation = recommendAction({ score: 0, level: 'unscored', signals: [] });

    expect(recommendation.action).toBe('wait_for_id');
    expect(recommendation.headline).toBe('Wait for ID check');
  });

  it('approves a clean booking', () => {
    expect(recommendAction(riskWithScore(0)).action).toBe('approve');
  });

  it('approves at 29 and requests verification at 30', () => {
    expect(recommendAction(riskWithScore(29)).action).toBe('approve');
    expect(recommendAction(riskWithScore(30)).action).toBe('request_verification');
  });

  it('requests verification at 84 and declines at 85', () => {
    expect(recommendAction(riskWithScore(84)).action).toBe('request_verification');
    expect(recommendAction(riskWithScore(85)).action).toBe('decline');
  });

  it('declines at the 100 cap', () => {
    expect(recommendAction(riskWithScore(100)).action).toBe('decline');
  });

  it('declines a failed ID check whatever the score', () => {
    // 40 alone would only be medium → verification, if not for the ID rule.
    const recommendation = recommendAction(riskWithScore(40, [idFailed]));

    expect(recommendation.action).toBe('decline');
    expect(recommendation.rationale).toMatch(/ID check failed/);
  });

  it('mentions a higher deposit only when the risk is high', () => {
    const medium = recommendAction(riskWithScore(59));
    const high = recommendAction(riskWithScore(60));

    expect(medium.action).toBe('request_verification');
    expect(medium.rationale).not.toMatch(/deposit/i);

    expect(high.action).toBe('request_verification');
    expect(high.rationale).toMatch(/higher deposit/i);
  });

  it('gives every recommendation a headline and a rationale', () => {
    for (const score of [0, 30, 60, 85]) {
      const { headline, rationale } = recommendAction(riskWithScore(score));
      expect(headline.length).toBeGreaterThan(0);
      expect(rationale.length).toBeGreaterThan(0);
    }
  });
});

describe('approveBlockedReason', () => {
  it('blocks Approve while the ID check is pending', () => {
    const recommendation = recommendAction({ score: 0, level: 'unscored', signals: [] });

    expect(approveBlockedReason(recommendation)).toBe(
      'Approve is unavailable until the ID check returns.',
    );
  });

  it('allows Approve for every scored booking, even one recommended for decline', () => {
    expect(approveBlockedReason(recommendAction(riskWithScore(0)))).toBeNull();
    expect(approveBlockedReason(recommendAction(riskWithScore(45)))).toBeNull();
    expect(approveBlockedReason(recommendAction(riskWithScore(100, [idFailed])))).toBeNull();
  });
});

describe('low-risk wording', () => {
  const firstTime: RiskSignal = {
    id: 'first_time_renter',
    label: 'First-time renter',
    points: 10,
    detail: 'No completed trips',
  };
  const longTrip: RiskSignal = {
    id: 'long_trip',
    label: 'Trip longer than 14 days',
    points: 5,
    detail: '20-day trip',
  };

  it('says nothing needs a second look only when no signal fired', () => {
    expect(recommendAction(riskWithScore(0)).rationale).toBe(
      'Low risk: nothing here needs a second look.',
    );
  });

  it('mentions one fired signal instead of contradicting it', () => {
    const rationale = recommendAction(riskWithScore(10, [firstTime])).rationale;

    expect(rationale).toBe('Low risk. One signal to glance at; fine to approve.');
  });

  it('counts several fired signals', () => {
    const rationale = recommendAction(riskWithScore(15, [firstTime, longTrip])).rationale;

    expect(rationale).toBe('Low risk. 2 signals to glance at; fine to approve.');
  });
});

describe('recommendationForStatus', () => {
  const verify = recommendAction(riskWithScore(45));
  const waitForId = recommendAction({ score: 0, level: 'unscored', signals: [] });

  it('passes the recommendation through while the booking needs review', () => {
    expect(recommendationForStatus('needs_review', verify)).toBe(verify);
  });

  it('waits on the renter once verification has been requested', () => {
    expect(recommendationForStatus('verification_requested', verify)).toEqual({
      action: 'wait_for_renter',
      headline: 'Waiting on the renter',
      rationale: 'Approve once they’re verified, or decline.',
    });
  });

  it('keeps waiting for a pending ID check after verification is requested', () => {
    const fitted = recommendationForStatus('verification_requested', waitForId);

    expect(fitted).toBe(waitForId);
    expect(approveBlockedReason(fitted!)).not.toBeNull();
  });

  it('suggests nothing for a final booking', () => {
    expect(recommendationForStatus('approved', verify)).toBeNull();
    expect(recommendationForStatus('declined', verify)).toBeNull();
  });
});
