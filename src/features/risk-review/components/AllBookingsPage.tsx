import { EmptyState } from '@/components/ui/EmptyState';

/** Every booking, whatever its status. Filled in by the next commit. */
export function AllBookingsPage() {
  return (
    <section aria-label="All bookings">
      <EmptyState title="All bookings" description="The full booking list will appear here." />
    </section>
  );
}
