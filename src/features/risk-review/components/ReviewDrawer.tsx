import * as Dialog from '@radix-ui/react-dialog';
import { useId, useState } from 'react';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { bookingFacts } from '../lib/bookingFacts';
import { carName, tripDates } from '../lib/bookingText';
import { recommendationForStatus } from '../lib/recommendAction';
import { MAX_SCORE } from '../lib/risk.config';
import { STATUS_LABELS } from '../lib/statusLabels';
import { nextStatuses } from '../lib/transitions';
import type { BookingStatus, ScoredBooking } from '../types';
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
  /** Why the last update from this drawer failed, shown inline. Null when it didn't. */
  error: string | null;
  onClose: () => void;
  onAction: (bookingId: string, next: BookingStatus, declineReason: string | null) => void;
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
  error,
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
        <Dialog.Overlay className="bg-ink/40 fixed inset-0 z-40" />
        <Dialog.Content
          // Radix hides the rest of the page from screen readers but doesn't
          // set this, so say it explicitly: everything else is out of reach.
          aria-modal="true"
          // By default Radix refocuses whatever had focus before opening. After a
          // row click that's nothing useful, so the page picks the target itself.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
          // Only × and Esc close the drawer. A stray click outside (on the
          // overlay, a toast or the demo controls) must never throw away a
          // half-typed decline reason.
          onInteractOutside={(event) => event.preventDefault()}
          className="md:rounded-l-card md:border-line fixed inset-0 z-40 flex flex-col bg-white shadow-xl md:inset-y-0 md:right-0 md:left-auto md:w-[30rem] md:border-l"
        >
          {/* `key` remounts the body per booking, so its local state starts fresh. */}
          {item && (
            <DrawerBody
              key={item.booking.id}
              item={item}
              isPending={isPending}
              error={error}
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
  error: string | null;
  onAction: ReviewDrawerProps['onAction'];
};

/** The change this drawer started: where the booking was, and where it's going. */
type Acted = { from: BookingStatus; to: BookingStatus };

function DrawerBody({ item, isPending, error, onAction }: DrawerBodyProps) {
  const { booking, risk } = item;
  const id = useId();
  const [isDeclining, setIsDeclining] = useState(false);
  // The update is optimistic: while it's in flight, `booking.status` already
  // shows the new status. The buttons keep showing the choices the operator
  // acted on, disabled, instead of vanishing mid-save.
  const [acted, setActed] = useState<Acted | null>(null);
  const actionStatus = isPending && acted ? acted.from : booking.status;
  const isFinal = nextStatuses(actionStatus).length === 0;
  const recommendation = recommendationForStatus(actionStatus, item.recommendation);
  const signalTotal = risk.signals.reduce((sum, signal) => sum + signal.points, 0);

  function submit(next: BookingStatus, declineReason: string | null) {
    setActed({ from: booking.status, to: next });
    onAction(booking.id, next, declineReason);
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
      <header className="border-line flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <p className="text-subtle text-xs font-medium">{booking.id}</p>
          <Dialog.Title className="text-ink text-lg font-bold break-words">
            {booking.renter.fullName}
          </Dialog.Title>
          <Dialog.Description className="text-muted text-sm break-words">
            {carName(booking)} · {tripDates(booking)}
          </Dialog.Description>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <StatusBadge status={booking.status} />
            <span className="text-muted">
              Total{' '}
              <span className="text-ink font-semibold tabular-nums">
                {formatCurrency(booking.totalAmount)}
              </span>
            </span>
            {isPending && <span className="text-subtle text-xs">Saving…</span>}
          </div>
        </div>
        <Dialog.Close
          aria-label="Close review"
          className="text-subtle hover:bg-surface-alt hover:text-ink -mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-xl leading-none"
        >
          <span aria-hidden="true">×</span>
        </Dialog.Close>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section aria-labelledby={`${id}-risk`} className="space-y-3">
          <h3 id={`${id}-risk`} className="text-ink text-sm font-bold">
            Risk
          </h3>
          {risk.level === 'unscored' ? (
            <>
              <p className="text-ink text-sm font-medium">Risk score pending ID check</p>
              <dl className="divide-line border-line divide-y rounded-md border text-sm">
                {bookingFacts(booking).map((fact) => (
                  <div key={fact.label} className="flex justify-between gap-3 px-3 py-2">
                    <dt className="text-muted">{fact.label}</dt>
                    <dd className="text-ink text-right font-medium">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <RiskBadge risk={risk} />
                <span className="text-muted text-sm">
                  Score{' '}
                  <span className="text-ink font-semibold tabular-nums">
                    {risk.score} / {MAX_SCORE}
                  </span>
                </span>
              </div>
              {/* Otherwise the points listed below wouldn't add up to the score. */}
              {signalTotal > MAX_SCORE && (
                <p className="text-muted text-sm">
                  Signals total {signalTotal} · score capped at {MAX_SCORE}
                </p>
              )}
              <SignalList signals={risk.signals} />
            </>
          )}
        </section>

        {recommendation && <RecommendationCard recommendation={recommendation} />}

        {isFinal && (
          <section aria-labelledby={`${id}-decision`} className="space-y-1">
            <h3 id={`${id}-decision`} className="text-ink text-sm font-bold">
              Decided
            </h3>
            <p className="text-muted text-sm">
              {STATUS_LABELS[booking.status]}
              {booking.decidedAt && (
                <>
                  {' '}
                  <time dateTime={booking.decidedAt}>
                    {formatDateTime(new Date(booking.decidedAt))}
                  </time>
                </>
              )}
              . This decision is final.
            </p>
            {booking.declineReason && (
              <p className="text-muted text-sm">
                <span className="text-ink font-medium">Reason: </span>
                {booking.declineReason}
              </p>
            )}
          </section>
        )}
      </div>

      {!isFinal && (
        // pb-24 below md keeps a 12px gap between the actions and the collapsed demo controls.
        <footer className="border-line space-y-3 border-t p-4 pb-24 md:pb-4">
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
              pendingStatus={acted?.to ?? null}
              onAction={handleAction}
            />
          )}
        </footer>
      )}
    </>
  );
}
