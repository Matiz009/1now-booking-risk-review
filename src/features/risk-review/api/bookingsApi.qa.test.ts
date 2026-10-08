import { beforeEach, describe, expect, it } from 'vitest';
import { configureApi, getBookings, resetApi, updateBookingStatus } from './bookingsApi';

/** QA additions (TEST_CASES.md TR-12, AC-08). */

beforeEach(() => {
  resetApi();
  configureApi({ delayMs: 0 });
});

describe('TR-12: decision time', () => {
  it('records decidedAt only when the new status is final', async () => {
    const verification = await updateBookingStatus('BK-1001', 'verification_requested', null);
    expect(verification.decidedAt).toBeNull();

    const approved = await updateBookingStatus('BK-1001', 'approved', null);
    expect(approved.decidedAt).not.toBeNull();

    const declined = await updateBookingStatus('BK-1002', 'declined', 'Could not verify identity.');
    expect(declined.decidedAt).not.toBeNull();
  });

  it('clears any decline reason sent with a non-decline status', async () => {
    const approved = await updateBookingStatus('BK-1001', 'approved', 'Ignored reason text');
    expect(approved.declineReason).toBeNull();
  });
});

describe('decline reason on the server', () => {
  it('rejects a whitespace-only reason', async () => {
    await expect(updateBookingStatus('BK-1001', 'declined', ' '.repeat(20))).rejects.toThrow(
      /at least 10 characters/,
    );
  });

  it('accepts exactly 10 characters after trimming and stores the trimmed text', async () => {
    const saved = await updateBookingStatus('BK-1001', 'declined', '  1234567890  ');
    expect(saved.declineReason).toBe('1234567890');
  });

  it('stores a very long reason intact', async () => {
    const reason = 'Renter failed callback.\n'.repeat(100).trim();
    await updateBookingStatus('BK-1001', 'declined', reason);

    const stored = (await getBookings()).find((b) => b.id === 'BK-1001');
    expect(stored?.declineReason).toBe(reason);
    expect(stored?.declineReason?.length).toBe(reason.length);
  });
});
