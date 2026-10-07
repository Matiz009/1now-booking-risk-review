import * as Dialog from '@radix-ui/react-dialog';
import { useId, useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { bookingFacts } from '../lib/bookingFacts';
import { carName, tripDates } from '../lib/bookingText';
import { MAX_SCORE } from '../lib/risk.config';
import { STATUS_LABELS } from '../lib/statusLabels';
import { nextStatuses } from '../lib/transitions';
import type { BookingStatus, ScoredBooking, UpdateOutcome } from '../types';
import { ActionBar } from './ActionBar';
import { DeclineReasonForm } from './DeclineReasonForm';
import { RecommendationCard } from './RecommendationCard';
import { RiskBadge } from './RiskBadge';
import { SignalList } from './SignalList';
import { StatusBadge } from './StatusBadge';

type ReviewDrawerProps = {
  /** The booking under review, or null when the drawer is closed. */
  item: ScoredBooking | null;
  isPending: boolean;
  onClose: () => void;
  /** Resolves when the API answers. On failure the drawer stays open to retry. */
  onAction: (
    bookingId: string,
    next: BookingStatus,
    declineReason: string | null,
  ) => Promise<UpdateOutcome>;
  /** Called once the drawer has closed, to put focus back where it belongs. */
  onRestoreFocus: () => void;
};

/**
 * A Radix Dialog styled as a side panel (a full-screen sheet below `md`).
 * Radix provides the focus trap, Esc to close, and hides the page behind it
 * from screen readers. It's controlled: open exactly when `item` is set.
 */
export function ReviewDrawer({
  item,
  isPending,
  onClose,
  onAction,
  onRestoreFocus,
}: ReviewDrawerProps) {
  return (
    <Dialog.Root
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
        <Dialog.Content
          // By default Radix refocuses whatever had focus before opening. After a
          // row click that's nothing useful, so the page picks the target itself.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
          // Toasts sit above the overlay. Dismissing one counts as a click
          // outside the drawer, which would close it and lose a typed reason.
          onInteractOutside={(event) => {
            if (event.target instanceof Element && event.target.closest('[data-toast-region]')) {
              event.preventDefault();
            }
          }}
          className="fixed inset-0 z-40 flex flex-col bg-white shadow-xl md:inset-y-0 md:right-0 md:left-auto md:w-[30rem] md:border-l md:border-slate-200"
        >
          {/* `key` remounts the body per booking, so its local state starts fresh. */}
          {item && (
            <DrawerBody
              key={item.booking.id}
              item={item}
              isPending={isPending}
              onAction={onAction}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type DrawerBodyProps = {
  item: ScoredBooking;
  isPending: boolean;
  onAction: ReviewDrawerProps['onAction'];
};

function DrawerBody({ item, isPending, onAction }: DrawerBodyProps) {
  const { booking, risk, recommendation } = item;
  const id = useId();
  const [isDeclining, setIsDeclining] = useState(false);
  // The update is optimistic: while it's in flight, `booking.status` already
  // shows the new status. The buttons keep showing the choices the operator
  // acted on, disabled, instead of vanishing mid-save.
  const [actedFrom, setActedFrom] = useState<BookingStatus | null>(null);
  const actionStatus = isPending && actedFrom ? actedFrom : booking.status;
  const isFinal = nextStatuses(actionStatus).length === 0;
  // Set when an update fails. The hook has already rolled the booking back,
  // so the actions are live again; this says what happened, inside the drawer.
  const [error, setError] = useState<string | null>(null);

  async function submit(next: BookingStatus, declineReason: string | null) {
    setActedFrom(booking.status);
    setError(null);
    const outcome = await onAction(booking.id, next, declineReason);
    // On success the page closes the drawer, so only failure needs handling.
    // The decline form stays mounted, so the typed reason is still there.
    if (!outcome.ok) {
      setError(
        next === 'declined'
          ? `Couldn’t decline ${booking.id}. Your reason is kept; try again.`
          : `${outcome.message} Try again.`,
      );
    }
  }

  function handleAction(next: BookingStatus) {
    if (next === 'declined') {
      setIsDeclining(true); // Decline asks for a reason first.
    } else {
      submit(next, null);
    }
  }

  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{booking.id}</p>
          <Dialog.Title className="text-lg font-semibold break-words text-slate-900">
            {booking.renter.fullName}
          </Dialog.Title>
          <Dialog.Description className="text-sm break-words text-slate-600">
            {carName(booking)} · {tripDates(booking)}
          </Dialog.Description>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <StatusBadge status={booking.status} />
            <span className="text-slate-700">
              Total{' '}
              <span className="font-semibold text-slate-900 tabular-nums">
                {formatCurrency(booking.totalAmount)}
              </span>
            </span>
            {isPending && <span className="text-xs text-slate-500">Saving…</span>}
          </div>
        </div>
        <Dialog.Close
          aria-label="Close review"
          className="-mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <span aria-hidden="true">×</span>
        </Dialog.Close>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section aria-labelledby={`${id}-risk`} className="space-y-3">
          <h3 id={`${id}-risk`} className="text-sm font-semibold text-slate-900">
            Risk
          </h3>
          {risk.level === 'unscored' ? (
            <>
              <p className="text-sm font-medium text-slate-900">Risk score pending ID check</p>
              <dl className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
                {bookingFacts(booking).map((fact) => (
                  <div key={fact.label} className="flex justify-between gap-3 px-3 py-2">
                    <dt className="text-slate-600">{fact.label}</dt>
                    <dd className="text-right font-medium text-slate-900">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <RiskBadge risk={risk} />
                <span className="text-sm text-slate-700">
                  Score{' '}
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {risk.score} / {MAX_SCORE}
                  </span>
                </span>
              </div>
              <SignalList signals={risk.signals} />
            </>
          )}
        </section>

        <RecommendationCard recommendation={recommendation} />

        {isFinal && (
          <section aria-labelledby={`${id}-decision`} className="space-y-1">
            <h3 id={`${id}-decision`} className="text-sm font-semibold text-slate-900">
              Decision
            </h3>
            <p className="text-sm text-slate-700">
              {STATUS_LABELS[booking.status]}. This decision is final.
            </p>
            {booking.declineReason && (
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">Reason: </span>
                {booking.declineReason}
              </p>
            )}
          </section>
        )}
      </div>

      {!isFinal && (
        <footer className="space-y-3 border-t border-slate-200 p-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
            >
              {error}
            </p>
          )}
          {isDeclining ? (
            <DeclineReasonForm
              isPending={isPending}
              onSubmit={(reason) => submit('declined', reason)}
              onCancel={() => setIsDeclining(false)}
            />
          ) : (
            <ActionBar
              status={actionStatus}
              recommendation={recommendation}
              isPending={isPending}
              onAction={handleAction}
            />
          )}
        </footer>
      )}
    </>
  );
}
