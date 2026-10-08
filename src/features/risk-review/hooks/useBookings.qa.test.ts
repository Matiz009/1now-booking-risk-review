import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApi, getBookings, resetApi } from '../api/bookingsApi';
import type { BookingStatus, UpdateOutcome } from '../types';
import { useBookings } from './useBookings';

/** QA additions (TEST_CASES.md AC-15, AC-16, plus the hook's load-race guard). */

beforeEach(() => {
  resetApi();
  configureApi({ delayMs: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

type HookResult = { current: ReturnType<typeof useBookings> };

async function renderLoaded() {
  const { result } = renderHook(() => useBookings());
  await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
  return result;
}

function bookingOf(result: HookResult, id: string) {
  return result.current.scoredBookings.find((s) => s.booking.id === id)?.booking;
}

function statusOf(result: HookResult, id: string): BookingStatus | undefined {
  return bookingOf(result, id)?.status;
}

describe('AC-16: updateStatus input edge cases', () => {
  it('reports an unknown booking without changing anything', async () => {
    const result = await renderLoaded();
    let outcome!: UpdateOutcome;

    await act(async () => {
      outcome = await result.current.updateStatus('BK-9999', 'approved');
    });

    expect(outcome).toEqual({ ok: false, message: 'Booking BK-9999 not found.' });
    expect(result.current.pendingIds).toEqual([]);
  });

  it('blocks a decline with no reason at all', async () => {
    const result = await renderLoaded();
    let outcome!: UpdateOutcome;

    await act(async () => {
      outcome = await result.current.updateStatus('BK-1001', 'declined', null);
    });

    expect(outcome.ok).toBe(false);
    expect(statusOf(result, 'BK-1001')).toBe('needs_review');
  });

  it('blocks a whitespace-only decline reason', async () => {
    const result = await renderLoaded();
    let outcome!: UpdateOutcome;

    await act(async () => {
      outcome = await result.current.updateStatus('BK-1001', 'declined', '\n\t          \n');
    });

    expect(outcome.ok).toBe(false);
    expect(statusOf(result, 'BK-1001')).toBe('needs_review');
  });

  it('accepts a reason of exactly 10 characters', async () => {
    const result = await renderLoaded();
    let outcome!: UpdateOutcome;

    await act(async () => {
      outcome = await result.current.updateStatus('BK-1001', 'declined', '1234567890');
    });

    expect(outcome).toEqual({ ok: true, message: 'BK-1001 declined.' });
    expect(bookingOf(result, 'BK-1001')?.declineReason).toBe('1234567890');
  });

  it('ignores a reason passed with a non-decline status', async () => {
    const result = await renderLoaded();

    await act(async () => {
      await result.current.updateStatus('BK-1001', 'approved', 'Not a decline at all');
    });

    expect(statusOf(result, 'BK-1001')).toBe('approved');
    expect(bookingOf(result, 'BK-1001')?.declineReason).toBeNull();
  });

  it('sets a decision time optimistically only for a final status', async () => {
    configureApi({ delayMs: 50 });
    const result = await renderLoaded();
    let pending!: Promise<unknown>;

    act(() => {
      pending = Promise.all([
        result.current.updateStatus('BK-1001', 'verification_requested'),
        result.current.updateStatus('BK-1002', 'approved'),
      ]);
    });

    expect(bookingOf(result, 'BK-1001')?.decidedAt).toBeNull();
    expect(bookingOf(result, 'BK-1002')?.decidedAt).not.toBeNull();
    await act(async () => {
      await pending;
    });
  });

  it('reports a failed verification request with its own wording', async () => {
    configureApi({ failUpdate: true });
    const result = await renderLoaded();
    let outcome!: UpdateOutcome;

    await act(async () => {
      outcome = await result.current.updateStatus('BK-1001', 'verification_requested');
    });

    expect(outcome).toEqual({
      ok: false,
      message: 'Couldn’t request verification for BK-1001. Change reverted.',
    });
    expect(statusOf(result, 'BK-1001')).toBe('needs_review');
  });
});

describe('AC-15: two updates to one booking before React re-renders', () => {
  // BUG (low, not reachable from the UI today): `updateStatus` reads
  // `pendingIds` from the render it was created in, so a second call in the
  // same tick isn't refused. Its snapshot overwrites the first one; when both
  // fail, the booking is "rolled back" to the first call's optimistic status
  // (verification_requested) while the server still says needs_review. The UI
  // is safe only because React re-renders between clicks and disables the
  // buttons; any future caller (bulk actions, keyboard shortcuts) would hit it.
  it.fails('refuses the second call and rolls back to the server state', async () => {
    configureApi({ failUpdate: true });
    const result = await renderLoaded();
    let outcomes!: UpdateOutcome[];

    await act(async () => {
      const update = result.current.updateStatus;
      outcomes = await Promise.all([
        update('BK-1001', 'verification_requested'),
        update('BK-1001', 'approved'),
      ]);
    });

    const server = (await getBookings()).find((b) => b.id === 'BK-1001');
    expect(server?.status).toBe('needs_review');
    expect(statusOf(result, 'BK-1001')).toBe(server?.status);
    expect(outcomes[1]).toEqual({
      ok: false,
      message: 'Booking BK-1001 is still being updated.',
    });
  });
});

describe('load responses that arrive too late are ignored', () => {
  it('keeps the newer load when an older, slower one fails afterwards', async () => {
    vi.useFakeTimers();
    // Load 1 waits 100 ms. Before it finishes, Retry starts load 2 with no delay.
    configureApi({ delayMs: 100 });
    const { result } = renderHook(() => useBookings());

    configureApi({ delayMs: 0 });
    act(() => result.current.reload());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.loadStatus).toBe('ready');

    // Load 1 now finishes, and fails. It belongs to an effect that was cleaned up.
    configureApi({ failLoad: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.loadError).toBeNull();
    expect(result.current.scoredBookings).toHaveLength(12);
  });

  it('ignores a successful response that arrives after a newer load started', async () => {
    vi.useFakeTimers();
    configureApi({ delayMs: 100 });
    const { result } = renderHook(() => useBookings());

    // Load 2 fails fast; load 1 succeeds later and must not overwrite the error.
    configureApi({ delayMs: 0, failLoad: true });
    act(() => result.current.reload());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.loadStatus).toBe('error');

    configureApi({ failLoad: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(result.current.loadStatus).toBe('error');
  });
});
