import type { KeyboardEvent } from 'react';
import { formatCurrency, formatDateRange } from '@/lib/format';
import type { Booking, ScoredBooking } from '../types';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';

type BookingTableProps = {
  items: ScoredBooking[];
  /** Read by screen readers as the table's name, e.g. "Needs review bookings". */
  caption: string;
  pendingIds: string[];
  /** Called with the booking id on click, Enter or Space. Opens the drawer in Phase 5. */
  onSelect: (bookingId: string) => void;
};

/**
 * One list, two layouts. Both are in the DOM and CSS shows one: the table
 * from `md` up (`hidden md:block`), the stacked cards below it (`md:hidden`).
 * That avoids JavaScript screen-size checks and keeps 360px free of
 * horizontal scrolling.
 */
export function BookingTable({ items, caption, pendingIds, onSelect }: BookingTableProps) {
  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, bookingId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); // Space would otherwise scroll the page.
      onSelect(bookingId);
    }
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}. Select a row to review the booking.</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">
                Risk
              </th>
              <th scope="col" className="px-4 py-3">
                Renter
              </th>
              <th scope="col" className="px-4 py-3">
                Car
              </th>
              <th scope="col" className="px-4 py-3">
                Trip
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Total
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(({ booking, risk }) => (
              // tabIndex makes the row itself focusable, so keyboard users can open it
              // with Enter and Phase 5 can return focus here when the drawer closes.
              <tr
                key={booking.id}
                tabIndex={0}
                onClick={() => onSelect(booking.id)}
                onKeyDown={(event) => handleRowKeyDown(event, booking.id)}
                className="cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-900"
              >
                <td className="px-4 py-3">
                  <RiskBadge risk={risk} />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{booking.renter.fullName}</div>
                  <div className="text-xs text-slate-500">{booking.id}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{carName(booking)}</td>
                <td className="px-4 py-3 text-slate-700">{tripDates(booking)}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-900 tabular-nums">
                  {formatCurrency(booking.totalAmount)}
                </td>
                <td className="px-4 py-3">
                  <StatusCell booking={booking} isPending={pendingIds.includes(booking.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {items.map(({ booking, risk }) => (
          <li key={booking.id}>
            <button
              type="button"
              onClick={() => onSelect(booking.id)}
              className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <RiskBadge risk={risk} />
                <StatusCell booking={booking} isPending={pendingIds.includes(booking.id)} />
              </span>
              <span className="mt-3 flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-medium break-words text-slate-900">
                    {booking.renter.fullName}
                  </span>
                  <span className="block text-xs text-slate-500">{booking.id}</span>
                </span>
                <span className="shrink-0 font-medium text-slate-900 tabular-nums">
                  {formatCurrency(booking.totalAmount)}
                </span>
              </span>
              <span className="mt-2 block text-sm break-words text-slate-700">
                {carName(booking)}
              </span>
              <span className="block text-sm text-slate-600">{tripDates(booking)}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

type StatusCellProps = {
  booking: Booking;
  isPending: boolean;
};

function StatusCell({ booking, isPending }: StatusCellProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <StatusBadge status={booking.status} />
      {isPending && <span className="text-xs text-slate-500">Saving…</span>}
    </span>
  );
}

function carName({ car }: Booking): string {
  return `${car.year} ${car.make} ${car.model}`;
}

function tripDates(booking: Booking): string {
  return formatDateRange(new Date(booking.pickupAt), new Date(booking.returnAt));
}
