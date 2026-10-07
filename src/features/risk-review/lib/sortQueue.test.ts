import { describe, expect, it } from 'vitest';
import { mockBookings } from '../data/bookings.mock';
import type { RiskLevel, ScoredBooking } from '../types';
import { riskLevelFor } from './scoreBooking';
import { sortQueue } from './sortQueue';

const template = mockBookings[0]!;

/** A real booking shape with only the fields sortQueue reads changed. */
function item(id: string, score: number, pickupAt: string, level?: RiskLevel): ScoredBooking {
  return {
    booking: { ...template, id, pickupAt },
    risk: { score, level: level ?? riskLevelFor(score), signals: [] },
    recommendation: { action: 'approve', headline: '', rationale: '' },
  };
}

const ids = (items: ScoredBooking[]) => items.map((i) => i.booking.id);

describe('sortQueue', () => {
  it('puts unscored bookings first, even above the highest score', () => {
    const sorted = sortQueue([
      item('A', 100, '2026-10-10T10:00:00Z'),
      item('B', 0, '2026-10-12T10:00:00Z', 'unscored'),
    ]);
    expect(ids(sorted)).toEqual(['B', 'A']);
  });

  it('sorts by score, highest first', () => {
    const sorted = sortQueue([
      item('A', 10, '2026-10-10T10:00:00Z'),
      item('B', 65, '2026-10-10T10:00:00Z'),
      item('C', 35, '2026-10-10T10:00:00Z'),
    ]);
    expect(ids(sorted)).toEqual(['B', 'C', 'A']);
  });

  it('breaks a score tie by earliest pickup', () => {
    const sorted = sortQueue([
      item('A', 10, '2026-10-12T10:00:00Z'),
      item('B', 10, '2026-10-09T10:00:00Z'),
    ]);
    expect(ids(sorted)).toEqual(['B', 'A']);
  });

  it('breaks a full tie by booking id, so the order is stable', () => {
    const sorted = sortQueue([
      item('BK-2', 10, '2026-10-10T10:00:00Z'),
      item('BK-1', 10, '2026-10-10T10:00:00Z'),
    ]);
    expect(ids(sorted)).toEqual(['BK-1', 'BK-2']);
  });

  it('does not change the array it was given', () => {
    const input = [item('A', 10, '2026-10-10T10:00:00Z'), item('B', 90, '2026-10-10T10:00:00Z')];
    sortQueue(input);
    expect(ids(input)).toEqual(['A', 'B']);
  });
});
