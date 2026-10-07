import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { STATUS_LABELS, STATUS_ORDER, statusTabId } from '../lib/statusLabels';
import type { BookingStatus } from '../types';

type StatusTabsProps = {
  active: BookingStatus;
  counts: Record<BookingStatus, number>;
  onChange: (status: BookingStatus) => void;
  /** The id of the panel these tabs control, for `aria-controls`. */
  panelId: string;
};

/**
 * The ARIA tabs pattern. Only the active tab is in the Tab order (a "roving
 * tabindex"); the arrow keys, Home and End move between tabs and select them.
 */
export function StatusTabs({ active, counts, onChange, panelId }: StatusTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const nextIndex = targetIndex(event.key, index);
    const nextStatus = nextIndex === null ? undefined : STATUS_ORDER[nextIndex];
    if (nextIndex === null || !nextStatus) {
      return;
    }
    event.preventDefault();
    onChange(nextStatus);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Booking status"
      className="bg-surface-alt ring-line grid auto-rows-fr grid-cols-2 gap-1 rounded-lg p-1 ring-1 ring-inset sm:flex"
    >
      {STATUS_ORDER.map((status, index) => {
        const isActive = status === active;
        return (
          <button
            key={status}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={statusTabId(status)}
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(status)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium sm:justify-start',
              isActive
                ? 'bg-primary text-ink shadow-sm'
                : 'text-muted hover:text-ink hover:bg-white',
            )}
          >
            {STATUS_LABELS[status]}{' '}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs tabular-nums',
                isActive ? 'text-ink bg-white/70' : 'text-muted bg-white',
              )}
            >
              {counts[status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Which tab a key moves to: arrows wrap around, Home and End jump to the ends. */
function targetIndex(key: string, index: number): number | null {
  const count = STATUS_ORDER.length;
  switch (key) {
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
