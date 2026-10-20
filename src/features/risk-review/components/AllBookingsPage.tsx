import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { useHashRoute } from '@/lib/useHashRoute';
import { useBookings } from '../hooks/useBookings';
import { paginate } from '../lib/paginate';
import { ALL_BOOKINGS_PAGE_SIZE } from '../lib/risk.config';
import { AllBookingsTable } from './AllBookingsTable';

/**
 * Every booking, whatever its status, oldest id first. Read-only: decisions
 * are made in the review queue. The current page lives in the URL
 * (#/bookings?page=2), so Back and Forward step through pages.
 */
export function AllBookingsPage() {
  const { scoredBookings, loadStatus, loadError, reload } = useBookings();
  const { params } = useHashRoute();
  // UI-only: which bookings have their problems expanded.
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  // A missing or bad ?page= gives 0 or NaN, which paginate clamps to page 1.
  const requestedPage = Number(params.get('page'));

  const current = useMemo(() => {
    const byId = [...scoredBookings].sort((a, b) => a.booking.id.localeCompare(b.booking.id));
    return paginate(byId, requestedPage, ALL_BOOKINGS_PAGE_SIZE);
  }, [scoredBookings, requestedPage]);

  function goToPage(page: number) {
    window.location.hash = `#/bookings?page=${page}`;
  }

  function toggle(bookingId: string) {
    setExpandedIds((ids) =>
      ids.includes(bookingId) ? ids.filter((id) => id !== bookingId) : [...ids, bookingId],
    );
  }

  return (
    <section aria-label="All bookings" className="space-y-4">
      <div>
        <h2 className="text-base font-bold">All bookings</h2>
        <p className="text-muted mt-0.5 text-sm">
          Every booking in every status. A red alert marks high risk or a failed ID check.
        </p>
      </div>

      {loadStatus === 'loading' && (
        <div role="status" aria-label="Loading bookings" className="space-y-3">
          {Array.from({ length: ALL_BOOKINGS_PAGE_SIZE }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {loadStatus === 'error' && (
        <ErrorState
          title="Couldn’t load bookings"
          message={loadError ?? 'Check your connection and try again.'}
          onRetry={reload}
        />
      )}

      {loadStatus === 'ready' &&
        (current.total === 0 ? (
          <EmptyState
            title="No bookings yet"
            description="Every direct booking will appear here."
          />
        ) : (
          <>
            <AllBookingsTable items={current.items} expandedIds={expandedIds} onToggle={toggle} />
            <Pagination
              page={current.page}
              totalPages={current.totalPages}
              start={current.start}
              end={current.end}
              total={current.total}
              onPageChange={goToPage}
            />
          </>
        ))}
    </section>
  );
}
