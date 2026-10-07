import { useCallback, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toast, type ToastMessage } from '@/components/ui/Toast';
import { useBookings } from '../hooks/useBookings';
import { sortQueue } from '../lib/sortQueue';
import { STATUS_LABELS, statusTabId } from '../lib/statusLabels';
import type { BookingStatus } from '../types';
import { BookingTable } from './BookingTable';
import { DevPanel } from './DevPanel';
import { StatusTabs } from './StatusTabs';

const PANEL_ID = 'risk-review-panel';
const TOAST_DURATION_MS = 5000;
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
 * here is UI-only: which tab is open, and which toasts are showing.
 */
export function RiskReviewPage() {
  const { scoredBookings, loadStatus, pendingIds, reload, apiSettings, updateApiSettings } =
    useBookings();
  const [activeTab, setActiveTab] = useState<BookingStatus>('needs_review');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextToastId = useRef(1);

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

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (tone: ToastMessage['tone'], message: string) => {
      const id = nextToastId.current++;
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
    },
    [dismissToast],
  );

  // Placeholder until Phase 5 opens the review drawer here instead.
  const handleSelect = useCallback(
    (bookingId: string) => showToast('info', `Review drawer for ${bookingId} arrives in Phase 5.`),
    [showToast],
  );

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
          message="Check your connection and try again."
          onRetry={reload}
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
                <p className="mb-3 text-sm text-slate-600">
                  Sorted by risk · bookings awaiting ID checks first
                </p>
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
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
