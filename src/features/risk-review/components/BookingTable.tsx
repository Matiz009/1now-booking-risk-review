import { formatCurrency, formatDateRange } from '@/lib/format';
import type { Booking, ScoredBooking } from '../types';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';

type BookingTableProps = {
  items: ScoredBooking[];
  /** Read by screen readers as the table's name, e.g. "Needs review bookings". */
  caption: string;
  pendingIds: string[];
  /** Called with the booking id when a row, its renter button or a card is activated. */
  onSelect: (bookingId: string) => void;
};

/**
 * One list, two layouts. Both are in the DOM and CSS shows one: the table
 * from `md` up (`hidden md:block`), the stacked cards below it (`md:hidden`).
 * That avoids JavaScript screen-size checks and keeps 360px free of
 * horizontal scrolling.
 */
export function BookingTable({ items, caption, pendingIds, onSelect }: BookingTableProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}. Select a renter to review the booking.</caption>
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
              // The whole row is a mouse target. The renter button below is the one
              // keyboard and screen-reader entry point, so each row is one Tab stop.
              <tr
                key={booking.id}
                onClick={() => onSelect(booking.id)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <RiskBadge risk={risk} />
                </td>
                <td className="px-4 py-3">
                  {/* No onClick of its own: a click (or Enter/Space, which browsers turn
                      into a click) bubbles up to the row's onClick, so onSelect runs once. */}
                  <button
                    type="button"
                    className="rounded-sm text-left font-medium text-slate-900 hover:underline"
                  >
                    {booking.renter.fullName}
                  </button>
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
