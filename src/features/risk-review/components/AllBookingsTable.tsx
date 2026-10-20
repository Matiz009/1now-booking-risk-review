import { Fragment } from 'react';
import { formatCurrency } from '@/lib/format';
import { carName, tripDates } from '../lib/bookingText';
import { isSuspicious } from '../lib/suspicion';
import type { ScoredBooking } from '../types';
import { ProblemsButton } from './ProblemsButton';
import { ProblemsDetails } from './ProblemsDetails';
import { RiskBadge } from './RiskBadge';
import { StatusBadge } from './StatusBadge';

/** Every column, so the expanded details row can span them all. */
const COLUMN_COUNT = 7;

type AllBookingsTableProps = {
  items: ScoredBooking[];
  /** Bookings whose problems are showing. */
  expandedIds: string[];
  onToggle: (bookingId: string) => void;
};

/**
 * Read-only list of bookings in any status, in the same two layouts as
 * BookingTable: a table from `md` up, stacked cards below. Both are in the DOM,
 * so each details panel's id ends in -table or -card to stay unique.
 */
export function AllBookingsTable({ items, expandedIds, onToggle }: AllBookingsTableProps) {
  return (
    <>
      <div className="rounded-card border-line shadow-card hidden overflow-hidden border bg-white md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">All bookings</caption>
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
                Dates
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Total
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Alert
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {items.map(({ booking, risk }) => {
              const isExpanded = expandedIds.includes(booking.id);
              const detailsId = `problems-${booking.id}-table`;
              // A Fragment groups the row and its details row without an extra
              // element, which a <tbody> wouldn't allow. It takes the key.
              return (
                <Fragment key={booking.id}>
                  <tr>
                    <td className="px-4 py-3">
                      <RiskBadge risk={risk} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-ink font-medium">{booking.renter.fullName}</div>
                      <div className="text-subtle text-xs">{booking.id}</div>
                    </td>
                    <td className="text-muted px-4 py-3">{carName(booking)}</td>
                    <td className="text-muted px-4 py-3">{tripDates(booking)}</td>
                    <td className="text-ink px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(booking.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={booking.status} />
                    </td>
                    <td className="px-4 py-3">
                      {isSuspicious(risk) && (
                        <ProblemsButton
                          bookingId={booking.id}
                          count={risk.signals.length}
                          isExpanded={isExpanded}
                          controlsId={detailsId}
                          onToggle={() => onToggle(booking.id)}
                        />
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-surface-alt">
                      <td colSpan={COLUMN_COUNT} className="px-4 py-3">
                        <ProblemsDetails id={detailsId} risk={risk} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="All bookings">
        {items.map(({ booking, risk }) => {
          const isExpanded = expandedIds.includes(booking.id);
          const detailsId = `problems-${booking.id}-card`;
          return (
            <li
              key={booking.id}
              className="rounded-card border-line shadow-card border bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <RiskBadge risk={risk} />
                <StatusBadge status={booking.status} />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-ink font-medium break-words">{booking.renter.fullName}</div>
                  <div className="text-subtle text-xs">{booking.id}</div>
                </div>
                <div className="text-ink shrink-0 font-medium tabular-nums">
                  {formatCurrency(booking.totalAmount)}
                </div>
              </div>
              <div className="text-muted mt-2 text-sm break-words">{carName(booking)}</div>
              <div className="text-muted text-sm">{tripDates(booking)}</div>
              {isSuspicious(risk) && (
                <div className="mt-3 space-y-3">
                  <ProblemsButton
                    bookingId={booking.id}
                    count={risk.signals.length}
                    isExpanded={isExpanded}
                    controlsId={detailsId}
                    onToggle={() => onToggle(booking.id)}
                  />
                  {isExpanded && <ProblemsDetails id={detailsId} risk={risk} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
