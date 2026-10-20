import { describe, expect, it } from 'vitest';
import type { RiskLevel, RiskResult, RiskSignal } from '../types';
import { riskLevelFor } from './scoreBooking';
import { isSuspicious, uncappedScore } from './suspicion';

const idFailed: RiskSignal = {
  id: 'id_check_failed',
  label: 'ID check failed',
  points: 40,
  detail: '',
};
const prepaid: RiskSignal = { id: 'prepaid_card', label: 'Prepaid card', points: 15, detail: '' };

function risk(score: number, signals: RiskSignal[] = [], level?: RiskLevel): RiskResult {
  return { score, level: level ?? riskLevelFor(score), signals };
}

describe('isSuspicious', () => {
  it('is true for a high-risk booking', () => {
    expect(isSuspicious(risk(65, [prepaid]))).toBe(true);
  });

  it('is false for medium and low risk without a failed ID check', () => {
    expect(isSuspicious(risk(45, [prepaid]))).toBe(false);
    expect(isSuspicious(risk(10))).toBe(false);
  });

  it('is true for a failed ID check even below high risk', () => {
    expect(isSuspicious(risk(40, [idFailed]))).toBe(true);
  });

  it('is false while the ID check is pending (unscored)', () => {
    expect(isSuspicious(risk(0, [], 'unscored'))).toBe(false);
  });

  it('flips at the high threshold: 59 is not suspicious, 60 is', () => {
    expect(isSuspicious(risk(59))).toBe(false);
    expect(isSuspicious(risk(60))).toBe(true);
  });
});

describe('uncappedScore', () => {
  it('adds up every signal, even past the 100 cap', () => {
    const signals = [idFailed, { ...idFailed, points: 25 }, prepaid, prepaid, prepaid];
    expect(uncappedScore(risk(100, signals))).toBe(110);
  });

  it('is 0 when no signal fired', () => {
    expect(uncappedScore(risk(0))).toBe(0);
  });
});
