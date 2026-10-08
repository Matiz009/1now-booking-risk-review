import { describe, expect, it } from 'vitest';
import type { RiskSignal } from '../types';
import { recommendAction } from './recommendAction';

/** QA addition (TEST_CASES.md RC-03): the order of the recommendation rules. */

const idFailed: RiskSignal = {
  id: 'id_check_failed',
  label: 'ID check failed',
  points: 40,
  detail: 'The ID verification came back as failed',
};

describe('RC-03: rule order', () => {
  it('gives the ID-check reason, not the score reason, when both decline rules match', () => {
    const recommendation = recommendAction({ score: 100, level: 'high', signals: [idFailed] });

    expect(recommendation.action).toBe('decline');
    expect(recommendation.rationale).toMatch(/ID check failed/);
    expect(recommendation.rationale).not.toMatch(/threshold/);
  });

  it('names the score and threshold when a decline comes from the score alone', () => {
    const recommendation = recommendAction({ score: 90, level: 'high', signals: [] });

    expect(recommendation.action).toBe('decline');
    expect(recommendation.rationale).toMatch(/90/);
    expect(recommendation.rationale).toMatch(/85/);
  });
});
