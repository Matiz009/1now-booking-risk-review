import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toast } from '@/components/ui/Toast';
import { useToasts } from '@/components/ui/useToasts';
import { matchesMedia } from '@/lib/media';
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

// Tailwind's `md` breakpoint. Below it the drawer is a full-screen sheet.
const MD_UP = '(min-width: 48rem)';
// Wide enough for the open demo controls (1rem gap + 22rem) to sit beside the
// 30rem drawer with a 1rem gap between them. Keep in step with DevPanel and
// ReviewDrawer's widths.
const ROOM_BESIDE_DRAWER = '(min-width: 54rem)';

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
    resetDemo,
  } = useBookings();
  const [activeTab, setActiveTab] = useState<BookingStatus>('needs_review');
  // Only the id is kept, never a copy of the booking, so the drawer always
  // shows the hook's current version (including optimistic changes).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Why the last update from the drawer failed, shown inside the drawer.
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const { toasts, showToast, dismissToast, dismissTone } = useToasts();
  // Whether the demo controls are expanded. Collapsed from the start on phones,
  // where they'd cover the page. Passing a function to useState runs it once,
  // on the first render only, instead of on every render.
  const [isDemoOpen, setIsDemoOpen] = useState(() => matchesMedia(MD_UP));

  // The booking open in the drawer right now, as a ref, so handleAction can
  // read it after its `await` (state captured before the await would be stale).
  const openId = useRef<string | null>(null);
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

  const handleSelect = useCallback(
    (bookingId: string) => {
      openId.current = bookingId;
      lastSelectedId.current = bookingId;
      setSelectedId(bookingId);
      setDrawerError(null);
      // Old success toasts would sit on top of the drawer's action buttons.
      // Error toasts stay: they report something that still needs attention.
      dismissTone('success');
      // Without room beside the drawer, fold the demo controls down to their
      // small bar so they don't cover it. The operator can still expand them.
      if (!matchesMedia(ROOM_BESIDE_DRAWER)) {
        setIsDemoOpen(false);
      }
    },
    [dismissTone],
  );

  const handleClose = useCallback(() => {
    openId.current = null;
    setSelectedId(null);
    setDrawerError(null);
  }, []);

  // Click → useBookings.updateStatus (optimistic update, API call, rollback on
  // failure) → then, depending on the outcome and on whether the drawer is
  // still showing this booking:
  //   success               → close the drawer, success toast
  //   failure, drawer open  → inline error in the drawer only; its role="alert"
  //                           already announces it, so a toast would say it twice
  //   failure, drawer gone  → error toast
  const handleAction = useCallback(
    async (bookingId: string, next: BookingStatus, declineReason: string | null) => {
      setDrawerError(null);
      const outcome = await updateStatus(bookingId, next, declineReason);
      const isOpenOnThis = openId.current === bookingId;

      if (outcome.ok) {
        if (isOpenOnThis) {
          handleClose();
        }
        showToast('success', outcome.message);
      } else if (isOpenOnThis) {
        setDrawerError(
          next === 'declined'
            ? `Couldn’t decline ${bookingId}. Your reason is kept; try again.`
            : `${outcome.message} Try again.`,
        );
      } else {
        showToast('error', outcome.message);
      }
    },
    [updateStatus, showToast, handleClose],
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
    // Bottom padding so the floating demo controls don't hide the end of the list.
    <div className="space-y-6 pb-72 md:pb-56">
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
                  <p className="text-muted mb-3 text-sm">
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

      <DevPanel
        settings={apiSettings}
        isOpen={isDemoOpen}
        onOpenChange={setIsDemoOpen}
        isDrawerOpen={selected !== null}
        onChange={updateApiSettings}
        onReload={reload}
        onReset={resetDemo}
      />
      <ReviewDrawer
        item={selected}
        isPending={selected !== null && pendingIds.includes(selected.booking.id)}
        error={drawerError}
        onDismissError={() => setDrawerError(null)}
        onClose={handleClose}
        onAction={handleAction}
        onRestoreFocus={restoreFocus}
      />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
