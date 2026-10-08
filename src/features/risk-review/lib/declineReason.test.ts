import { describe, expect, it } from 'vitest';
import { declineReasonLength } from './declineReason';

describe('declineReasonLength', () => {
  it('counts plain text', () => {
    expect(declineReasonLength('1234567890')).toBe(10);
  });

  it('ignores leading and trailing whitespace', () => {
    expect(declineReasonLength('   short    ')).toBe(5);
    expect(declineReasonLength('\n\t  \n')).toBe(0);
  });

  it('counts an emoji as one character, not two', () => {
    expect(declineReasonLength('🚗🚗🚗🚗🚗')).toBe(5);
  });

  it('counts accented letters once', () => {
    expect(declineReasonLength('Zoë Müller')).toBe(10);
  });
});
