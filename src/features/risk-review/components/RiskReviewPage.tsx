import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toast } from '@/components/ui/Toast';
import { useToasts } from '@/components/ui/useToasts';
import { useBookings } from '../hooks/useBookings';
import { sortQueue } from '../lib/sortQueue';
import { STATUS_LABELS, statusTabId } from '../lib/statusLabels';
import type { BookingStatus } from '../types';
import { BookingTable } from './BookingTable';
import { DevPanel } from './DevPanel';
import { ReviewDrawer } from './ReviewDrawer';
import { StatusTabs } from './StatusTabs';

const PANEL_ID = 'risk-review-panel';
const SKELETON_ROWS = 5;

const EMPTY_TEXT: Record<BookingStatus, { title: string; description: string }> = {
  needs_review: {
    title: 'Nothing to review',
    description: 'New direct bookings will appear here, highest risk first.',
  },
  verification_requested: {
    title: 'No verifications pending',
    description: 'Bookings you ask the renter to verify will wait here until you decide.',
  },
  approved: {
    title: 'No approved bookings',
    description: 'Bookings you approve will appear here.',
  },
  declined: {
    title: 'No declined bookings',
    description: 'Bookings you decline will appear here with the reason you gave.',
  },
};

/**
 * Composes the feature. Booking data comes from useBookings; the state kept
 * here is UI-only: which tab is open, which booking is in the drawer, and
 * which toasts are showing.
 */
export function RiskReviewPage() {
  const {
    scoredBookings,
    loadStatus,
    loadError,
    pendingIds,
    reload,
    updateStatus,
    apiSettings,
    updateApiSettings,
  } = useBookings();
  const [activeTab, setActiveTab] = useState<BookingStatus>('needs_review');
  // Only the id is kept, never a copy of the booking, so the drawer always
  // shows the hook's current version (including optimistic changes).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toasts, showToast, dismissToast } = useToasts();

  // The last booking opened. Still set after the drawer closes, which is when
  // focus has to go back to it.
  const lastSelectedId = useRef<string | null>(null);

  // Set by Retry, read once the reload lands. A ref, because flipping it
  // shouldn't re-render anything.
  const focusTabAfterLoad = useRef(false);

  const counts = useMemo(() => {
    const result: Record<BookingStatus, number> = {
      needs_review: 0,
      verification_requested: 0,
      approved: 0,
      declined: 0,
    };
    for (const { booking } of scoredBookings) {
      result[booking.status] += 1;
    }
    return result;
  }, [scoredBookings]);

  const visible = useMemo(
    () => sortQueue(scoredBookings.filter(({ booking }) => booking.status === activeTab)),
    [scoredBookings, activeTab],
  );

  // The Retry button disappears while reloading, which drops focus to the top
  // of the page. Once the queue is back, put keyboard users on the selected tab.
  // An effect is right here: moving focus is a side effect on the DOM.
  useEffect(() => {
    if (loadStatus === 'ready' && focusTabAfterLoad.current) {
      focusTabAfterLoad.current = false;
      document.getElementById(statusTabId(activeTab))?.focus();
    }
  }, [loadStatus, activeTab]);

  const handleRetry = useCallback(() => {
    focusTabAfterLoad.current = true;
    reload();
  }, [reload]);

  const selected = scoredBookings.find(({ booking }) => booking.id === selectedId) ?? null;

  const handleSelect = useCallback((bookingId: string) => {
    lastSelectedId.current = bookingId;
    setSelectedId(bookingId);
  }, []);

  const handleClose = useCallback(() => setSelectedId(null), []);

  // Click → useBookings.updateStatus (optimistic update, API call, rollback on
  // failure) → close the drawer on success → toast the hook's message.
  const handleAction = useCallback(
    async (bookingId: string, next: BookingStatus, declineReason: string | null) => {
      const outcome = await updateStatus(bookingId, next, declineReason);
      // On success, close (if the operator is still looking at this booking).
      // On failure, keep it open: the drawer shows the error and allows a retry.
      if (outcome.ok) {
        setSelectedId((current) => (current === bookingId ? null : current));
      }
      showToast(outcome.ok ? 'success' : 'error', outcome.message);
      return outcome;
    },
    [updateStatus, showToast],
  );

  // Focus goes back to the control that opens the booking. Both layouts have
  // one and CSS hides one of them; focus() does nothing on a hidden element,
  // so try each until one takes it. If the booking has moved to another tab,
  // fall back to the selected tab.
  const restoreFocus = useCallback(() => {
    const triggers = document.querySelectorAll<HTMLElement>(
      `[data-review-trigger="${lastSelectedId.current}"]`,
    );
    for (const trigger of triggers) {
      trigger.focus();
      if (document.activeElement === trigger) {
        return;
      }
    }
    document.getElementById(statusTabId(activeTab))?.focus();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {loadStatus === 'loading' && (
        <div role="status" aria-label="Loading bookings" className="space-y-3">
          <Skeleton className="h-11 w-full rounded-lg" />
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {loadStatus === 'error' && (
        <ErrorState
          title="Couldn’t load bookings"
          message={loadError ?? 'Check your connection and try again.'}
          onRetry={handleRetry}
        />
      )}

      {loadStatus === 'ready' && (
        <section aria-label="Review queue" className="space-y-4">
          <StatusTabs
            active={activeTab}
            counts={counts}
            onChange={setActiveTab}
            panelId={PANEL_ID}
          />
          <div role="tabpanel" id={PANEL_ID} aria-labelledby={statusTabId(activeTab)}>
            {visible.length === 0 ? (
              <EmptyState {...EMPTY_TEXT[activeTab]} />
            ) : (
              <>
                {/* Every tab is sorted the same way, but the order only drives work in Needs review. */}
                {activeTab === 'needs_review' && (
                  <p className="mb-3 text-sm text-slate-600">
                    Sorted by risk · bookings awaiting ID checks first
                  </p>
                )}
                <BookingTable
                  items={visible}
                  caption={`${STATUS_LABELS[activeTab]} bookings`}
                  pendingIds={pendingIds}
                  onSelect={handleSelect}
                />
              </>
            )}
          </div>
        </section>
      )}

      <DevPanel settings={apiSettings} onChange={updateApiSettings} onReload={reload} />
      <ReviewDrawer
        item={selected}
        isPending={selected !== null && pendingIds.includes(selected.booking.id)}
        onClose={handleClose}
        onAction={handleAction}
        onRestoreFocus={restoreFocus}
      />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
