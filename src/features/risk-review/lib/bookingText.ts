import { formatDateRange } from '@/lib/format';
import type { Booking } from '../types';

/** "2024 BMW 330i". Shared by the queue and the review drawer. */
export function carName({ car }: Booking): string {
  return `${car.year} ${car.make} ${car.model}`;
}

/** "Oct 9 – Oct 12, 2026", from pickup to return. */
export function tripDates(booking: Booking): string {
  return formatDateRange(new Date(booking.pickupAt), new Date(booking.returnAt));
}
