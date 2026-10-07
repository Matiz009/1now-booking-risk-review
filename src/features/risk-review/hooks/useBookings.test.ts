import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureApi, getBookings, resetApi } from '../api/bookingsApi';
import type { BookingStatus, UpdateOutcome } from '../types';
import { useBookings } from './useBookings';

/**
 * delayMs: 0 makes every API call settle on the microtask queue, so no test
 * here uses real or fake timers. Each test starts from fresh mock data.
 */
beforeEach(() => {
  resetApi();
  configureApi({ delayMs: 0 });
});

type HookResult = { current: ReturnType<typeof useBookings> };

async function renderLoaded() {
  const { result } = renderHook(() => useBookings());
  await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
  return result;
}

function statusOf(result: HookResult, id: string): BookingStatus | undefined {
  return result.current.scoredBookings.find((s) => s.booking.id === id)?.booking.status;
}

describe('useBookings: loading', () => {
  it('starts loading, then has all 12 bookings with risk derived', async () => {
    const { result } = renderHook(() => useBookings());
    expect(result.current.loadStatus).toBe('loading');

    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    expect(result.current.scoredBookings).toHaveLength(12);
    const capped = result.current.scoredBookings.find((s) => s.booking.id === 'BK-1010');
    expect(capped?.risk.score).toBe(100);
    expect(capped?.recommendation.action).toBe('decline');
  });

  it('treats an empty list as a successful load, not an error', async () => {
    resetApi([]);
    configureApi({ delayMs: 0 });

    const result = await renderLoaded();

    expect(result.current.scoredBookings).toEqual([]);
    expect(result.current.loadError).toBeNull();
  });

  it('reports a load failure, and Retry recovers', async () => {
    configureApi({ failLoad: true });
    const { result } = renderHook(() => useBookings());

    await waitFor(() => expect(result.current.loadStatus).toBe('error'));
    expect(result.current.loadError).toMatch(/couldn’t load bookings/i);

    configureApi({ failLoad: false });
    act(() => result.current.reload());
    expect(result.current.loadStatus).toBe('loading');

    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(result.current.scoredBookings).toHaveLength(12);
    expect(result.current.loadError).toBeNull();
  });
});

describe('useBookings: optimistic updates', () => {
  it('shows the new status before the API answers, then keeps it', async () => {
    const result = await renderLoaded();
    let pending!: Promise<UpdateOutcome>;

    act(() => {
      pending = result.current.updateStatus('BK-1001', 'approved');
    });

    // The API hasn't settled yet: this is the optimistic state.
    expect(statusOf(result, 'BK-1001')).toBe('approved');
    expect(result.current.pendingIds).toEqual(['BK-1001']);

    let outcome!: UpdateOutcome;
    await act(async () => {
      outcome = await pending;
    });

    expect(outcome).toEqual({ ok: true, message: 'Booking BK-1001 approved.' });
    expect(statusOf(result, 'BK-1001')).toBe('approved');
    expect(result.current.pendingIds).toEqual([]);

    // And it was really saved on the "server".
    const saved = await getBookings();
    expect(saved.find((b) => b.id === 'BK-1001')?.status).toBe('approved');
  });

  it('stores the trimmed decline reason', async () => {
    const result = await renderLoaded();

    await act(async () => {
      await result.current.updateStatus(
        'BK-1008',
        'declined',
        '  Prepaid card and name mismatch.  ',
      );
    });

    const declined = result.current.scoredBookings.find((s) => s.booking.id === 'BK-1008');
    expect(declined?.booking.status).toBe('declined');
    expect(declined?.booking.declineReason).toBe('Prepaid card and name mismatch.');
  });

  it('rolls back and reports the booking when the API fails', async () => {
    configureApi({ failUpdate: true });
    const result = await renderLoaded();
    let pending!: Promise<UpdateOutcome>;

    act(() => {
      pending = result.current.updateStatus('BK-1007', 'declined', 'Name on ID does not match.');
    });
    expect(statusOf(result, 'BK-1007')).toBe('declined');

    let outcome!: UpdateOutcome;
    await act(async () => {
      outcome = await pending;
    });

    expect(outcome).toEqual({ ok: false, message: 'Couldn’t decline BK-1007. Change reverted.' });
    const restored = result.current.scoredBookings.find((s) => s.booking.id === 'BK-1007');
    expect(restored?.booking.status).toBe('needs_review');
    expect(restored?.booking.declineReason).toBeNull();
    expect(result.current.pendingIds).toEqual([]);
  });

  /**
   * The reason rollbacks are keyed by id. With a single rollback slot, B's
   * snapshot would overwrite A's, and A's failure would restore the wrong
   * booking.
   */
  it('rolls back only the failed update when two are in flight', async () => {
    configureApi({ failUpdateIds: ['BK-1001'] });
    const result = await renderLoaded();
    let first!: Promise<UpdateOutcome>;
    let second!: Promise<UpdateOutcome>;

    act(() => {
      first = result.current.updateStatus('BK-1001', 'approved');
      second = result.current.updateStatus('BK-1002', 'declined', 'No past trips, cash-like card.');
    });

    // Both applied optimistically, both in flight.
    expect(statusOf(result, 'BK-1001')).toBe('approved');
    expect(statusOf(result, 'BK-1002')).toBe('declined');
    expect(result.current.pendingIds).toEqual(['BK-1001', 'BK-1002']);

    let outcomes!: UpdateOutcome[];
    await act(async () => {
      outcomes = await Promise.all([first, second]);
    });

    expect(outcomes.map((o) => o.ok)).toEqual([false, true]);
    expect(statusOf(result, 'BK-1001')).toBe('needs_review');
    expect(statusOf(result, 'BK-1002')).toBe('declined');
    expect(result.current.pendingIds).toEqual([]);
  });
});

describe('useBookings: blocked updates never reach the API', () => {
  it('refuses a transition out of a final status', async () => {
    const result = await renderLoaded();
    let outcome!: UpdateOutcome;

    await act(async () => {
      outcome = await result.current.updateStatus('BK-1011', 'declined', 'Changed my mind here.');
    });

    expect(outcome.ok).toBe(false);
    expect(statusOf(result, 'BK-1011')).toBe('approved');
    expect(result.current.pendingIds).toEqual([]);
  });

  it('refuses a decline with a reason under 10 characters, ignoring padding', async () => {
    const result = await renderLoaded();
    let outcome!: UpdateOutcome;

    await act(async () => {
      outcome = await result.current.updateStatus('BK-1001', 'declined', '   too short   ');
    });

    expect(outcome).toEqual({
      ok: false,
      message: 'Give a reason of at least 10 characters to decline.',
    });
    expect(statusOf(result, 'BK-1001')).toBe('needs_review');
  });

  it('refuses a second update to a booking that is still in flight', async () => {
    const result = await renderLoaded();
    let first!: Promise<UpdateOutcome>;

    act(() => {
      first = result.current.updateStatus('BK-1001', 'verification_requested');
    });

    // After the re-render, the hook knows BK-1001 is pending.
    let second!: UpdateOutcome;
    await act(async () => {
      second = await result.current.updateStatus('BK-1001', 'approved');
      await first;
    });

    expect(second).toEqual({ ok: false, message: 'Booking BK-1001 is still being updated.' });
    expect(statusOf(result, 'BK-1001')).toBe('verification_requested');
  });
});
