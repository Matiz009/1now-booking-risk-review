import { describe, expect, it } from 'vitest';
import { mockBookings } from '../data/bookings.mock';
import type { Booking } from '../types';
import { carName, tripDates } from './bookingText';

const booking: Booking = {
  ...mockBookings[0]!,
  pickupAt: new Date(2026, 9, 9, 10).toISOString(),
  returnAt: new Date(2026, 9, 12, 10).toISOString(),
  car: { id: 'CAR-X', make: 'BMW', model: '330i', year: 2024, dailyRate: 180 },
};

describe('bookingText', () => {
  it('names the car by year, make and model', () => {
    expect(carName(booking)).toBe('2024 BMW 330i');
  });

  it('formats the trip from pickup to return', () => {
    expect(tripDates(booking)).toBe('Oct 9 – Oct 12, 2026');
  });
});
