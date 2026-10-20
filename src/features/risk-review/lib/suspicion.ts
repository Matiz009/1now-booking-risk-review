import type { RiskResult } from '../types';

/**
 * Whether a booking gets the red "problems" alert on the All bookings page:
 * high risk, or a failed ID check whatever the score. Pending (unscored)
 * bookings never qualify, because nothing has been judged yet.
 */
export function isSuspicious(risk: RiskResult): boolean {
  return risk.level === 'high' || risk.signals.some((signal) => signal.id === 'id_check_failed');
}

/** The points of every signal that fired, before the score is capped. */
export function uncappedScore(risk: RiskResult): number {
  return risk.signals.reduce((sum, signal) => sum + signal.points, 0);
}
