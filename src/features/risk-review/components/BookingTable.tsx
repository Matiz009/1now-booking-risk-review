import { formatCurrency } from '@/lib/format';
import { carName, tripDates } from '../lib/bookingText';
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
 * One list, two layouts.
 *
 * `data-review-trigger` marks the control that opens each booking, so the page
 * can hand focus back to it when the review drawer closes. Both are in the DOM and CSS shows one: the table
 * from `md` up (`hidden md:block`), the stacked cards below it (`md:hidden`).
 * That avoids JavaScript screen-size checks and keeps 360px free of
 * horizontal scrolling.
 */
export function BookingTable({ items, caption, pendingIds, onSelect }: BookingTableProps) {
  return (
    <>
      <div className="rounded-card border-line shadow-card hidden overflow-hidden border bg-white md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}. Select a renter to review the booking.</caption>
          <thead className="border-line bg-surface-alt text-muted border-b text-xs font-medium">
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
          <tbody className="divide-line divide-y">
            {items.map(({ booking, risk }) => (
              // The whole row is a mouse target. The renter button below is the one
              // keyboard and screen-reader entry point, so each row is one Tab stop.
              <tr
                key={booking.id}
                onClick={() => onSelect(booking.id)}
                className="hover:bg-surface-alt cursor-pointer"
              >
                <td className="px-4 py-3">
                  <RiskBadge risk={risk} />
                </td>
                <td className="px-4 py-3">
                  {/* No onClick of its own: a click (or Enter/Space, which browsers turn
                      into a click) bubbles up to the row's onClick, so onSelect runs once.
                      mb-1.5 keeps its focus outline (2px + 2px offset) clear of the id line. */}
                  <button
                    type="button"
                    data-review-trigger={booking.id}
                    className="text-ink decoration-primary mb-1.5 rounded-sm text-left font-medium decoration-2 underline-offset-4 hover:underline"
                  >
                    {booking.renter.fullName}
                  </button>
                  <div className="text-subtle text-xs">{booking.id}</div>
                </td>
                <td className="text-muted px-4 py-3">{carName(booking)}</td>
                <td className="text-muted px-4 py-3">{tripDates(booking)}</td>
                <td className="text-ink px-4 py-3 text-right font-medium tabular-nums">
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
              data-review-trigger={booking.id}
              onClick={() => onSelect(booking.id)}
              className="rounded-card border-line shadow-card hover:border-primary-border block w-full border bg-white p-4 text-left"
            >
              <span className="flex flex-wrap items-center justify-between gap-2">
                <RiskBadge risk={risk} />
                <StatusCell booking={booking} isPending={pendingIds.includes(booking.id)} />
              </span>
              <span className="mt-3 flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="text-ink block font-medium break-words">
                    {booking.renter.fullName}
                  </span>
                  <span className="text-subtle block text-xs">{booking.id}</span>
                </span>
                <span className="text-ink shrink-0 font-medium tabular-nums">
                  {formatCurrency(booking.totalAmount)}
                </span>
              </span>
              <span className="text-muted mt-2 block text-sm break-words">{carName(booking)}</span>
              <span className="text-muted block text-sm">{tripDates(booking)}</span>
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
      {isPending && <span className="text-subtle text-xs">Saving…</span>}
    </span>
  );
}
