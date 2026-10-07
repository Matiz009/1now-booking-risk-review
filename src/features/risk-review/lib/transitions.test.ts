import { describe, expect, it } from 'vitest';
import type { BookingStatus } from '../types';
import { canTransition, nextStatuses } from './transitions';

const ALL: BookingStatus[] = ['needs_review', 'verification_requested', 'approved', 'declined'];

/** The rules from CLAUDE.md, written out independently of transitions.ts. */
const allowed: Record<BookingStatus, BookingStatus[]> = {
  needs_review: ['approved', 'verification_requested', 'declined'],
  verification_requested: ['approved', 'declined'],
  approved: [],
  declined: [],
};

// Every from → to pair, all 16 of them, each tagged allowed or blocked.
const pairs = ALL.flatMap((from) =>
  ALL.map((to) => ({ from, to, expected: allowed[from].includes(to) })),
);

describe('canTransition', () => {
  it.each(pairs.filter((p) => p.expected))('allows $from → $to', ({ from, to }) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(pairs.filter((p) => !p.expected))('blocks $from → $to', ({ from, to }) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('checks all 16 pairs: 5 allowed, 11 blocked', () => {
    expect(pairs).toHaveLength(16);
    expect(pairs.filter((p) => p.expected)).toHaveLength(5);
  });
});

describe('nextStatuses', () => {
  it('lists what each status can move to', () => {
    for (const status of ALL) {
      expect([...nextStatuses(status)].sort()).toEqual([...allowed[status]].sort());
    }
  });

  it('treats approved and declined as final', () => {
    expect(nextStatuses('approved')).toEqual([]);
    expect(nextStatuses('declined')).toEqual([]);
  });
});
