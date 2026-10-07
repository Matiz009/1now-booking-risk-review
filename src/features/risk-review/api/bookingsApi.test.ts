import { beforeEach, describe, expect, it } from 'vitest';
import {
  configureApi,
  getApiConfig,
  getBookings,
  resetApi,
  updateBookingStatus,
} from './bookingsApi';

beforeEach(() => {
  resetApi();
  configureApi({ delayMs: 0 });
});

describe('getBookings', () => {
  it('returns the 12 mock bookings', async () => {
    expect(await getBookings()).toHaveLength(12);
  });

  it('returns copies, so editing the result does not change the store', async () => {
    const first = await getBookings();
    first[0]!.status = 'declined';
    first[0]!.renter.fullName = 'Changed';

    const second = await getBookings();
    expect(second[0]!.status).toBe('needs_review');
    expect(second[0]!.renter.fullName).toBe('Dana Whitfield');
  });

  it('rejects when failLoad is on', async () => {
    configureApi({ failLoad: true });
    await expect(getBookings()).rejects.toThrow(/couldn’t load bookings/i);
  });
});

describe('updateBookingStatus', () => {
  it('saves an allowed change and returns the updated booking', async () => {
    const updated = await updateBookingStatus('BK-1001', 'approved', null);

    expect(updated.status).toBe('approved');
    const stored = (await getBookings()).find((b) => b.id === 'BK-1001');
    expect(stored?.status).toBe('approved');
  });

  it('rejects every update when failUpdate is on', async () => {
    configureApi({ failUpdate: true });
    await expect(updateBookingStatus('BK-1001', 'approved', null)).rejects.toThrow(/server error/i);
  });

  it('rejects only the listed ids when failUpdateIds is set', async () => {
    configureApi({ failUpdateIds: ['BK-1001'] });

    await expect(updateBookingStatus('BK-1001', 'approved', null)).rejects.toThrow();
    await expect(updateBookingStatus('BK-1002', 'approved', null)).resolves.toMatchObject({
      status: 'approved',
    });
  });

  it('re-checks the rules the UI checks', async () => {
    await expect(updateBookingStatus('BK-1011', 'declined', 'Long enough reason.')).rejects.toThrow(
      /can’t move/,
    );
    await expect(updateBookingStatus('BK-1001', 'declined', 'short')).rejects.toThrow(
      /at least 10 characters/,
    );
    await expect(updateBookingStatus('BK-9999', 'approved', null)).rejects.toThrow(/not found/);
  });
});

describe('resetApi', () => {
  it('restores the default settings and fresh data', async () => {
    await updateBookingStatus('BK-1001', 'approved', null);
    configureApi({ failLoad: true, failUpdateIds: ['BK-1002'] });

    resetApi();

    expect(getApiConfig()).toEqual({
      delayMs: 600,
      failLoad: false,
      failUpdate: false,
      failUpdateIds: [],
    });

    configureApi({ delayMs: 0 });
    const fresh = (await getBookings()).find((b) => b.id === 'BK-1001');
    expect(fresh?.status).toBe('needs_review');
  });
});
