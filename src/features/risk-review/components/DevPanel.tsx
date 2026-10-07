import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import type { ApiConfig } from '../types';

const DELAY_OPTIONS = [0, 600, 2000];

type DevPanelProps = {
  settings: ApiConfig;
  /** Expanded (true) or folded down to its title bar (false). */
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** While the review drawer is open, the panel stays to its left from `md` up. */
  isDrawerOpen: boolean;
  onChange: (next: Partial<ApiConfig>) => void;
  onReload: () => void;
  onReset: () => void;
};

/**
 * Demo-only switches for the mock API, so failures and slow networks can be
 * shown on purpose. Dashed and striped so nobody mistakes it for the product.
 * `useId` gives each input a unique id for its <label>.
 *
 * It floats in the bottom-left corner above the review drawer's overlay
 * (z-50 vs z-40), so the demo can fail an update, untick the switch and retry
 * without closing the drawer. Three things make that work while the drawer is open:
 * - `pointer-events-auto`: Radix sets `pointer-events: none` on <body>.
 * - The drawer ignores outside clicks (ReviewDrawer's onInteractOutside).
 * - `aria-live="off"`: Radix hides everything outside the dialog from screen
 *   readers using the aria-hidden package, which skips elements that have an
 *   aria-live attribute. "off" is the default politeness, so nothing is announced.
 * A native <details> lets it collapse out of the way. Its open state lives in
 * the page, so the page can collapse it when the drawer needs the room;
 * `onToggle` reports clicks on the title bar back up.
 */
export function DevPanel({
  settings,
  isOpen,
  onOpenChange,
  isDrawerOpen,
  onChange,
  onReload,
  onReset,
}: DevPanelProps) {
  const id = useId();

  return (
    <aside
      aria-labelledby={`${id}-heading`}
      aria-live="off"
      className={cn(
        'pointer-events-auto fixed bottom-4 left-4 z-50 rounded-lg border-2 border-dashed border-amber-400 bg-[repeating-linear-gradient(135deg,var(--color-amber-50)_0_12px,var(--color-white)_12px_24px)] shadow-lg',
        // Collapsed, it shrinks to its title so it stays a small bar.
        isOpen ? 'w-[min(22rem,calc(100vw-2rem))]' : 'w-auto',
        // From md the drawer is 30rem wide on the right: never reach under it,
        // even when expanded by hand (1rem gap each side).
        isDrawerOpen && 'md:max-w-[calc(100vw-30rem-2rem)]',
      )}
    >
      <details open={isOpen} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
        <summary className="cursor-pointer rounded-md px-3 py-2">
          <h2 id={`${id}-heading`} className="inline text-sm font-semibold text-amber-900">
            Demo controls
          </h2>
        </summary>

        <div className="space-y-3 px-3 pb-3">
          <p className="text-xs text-amber-900/80">
            Not part of the product. These switches simulate the API for the demo.
          </p>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={settings.failLoad}
                onChange={(event) => onChange({ failLoad: event.target.checked })}
                className="size-4 accent-amber-600"
              />
              Fail loading bookings
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={settings.failUpdate}
                onChange={(event) => onChange({ failUpdate: event.target.checked })}
                className="size-4 accent-amber-600"
              />
              Fail status updates
            </label>

            <div className="flex items-center gap-2">
              <label htmlFor={`${id}-delay`} className="text-sm text-slate-800">
                API delay
              </label>
              <select
                id={`${id}-delay`}
                value={settings.delayMs}
                onChange={(event) => onChange({ delayMs: Number(event.target.value) })}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
              >
                {DELAY_OPTIONS.map((ms) => (
                  <option key={ms} value={ms}>
                    {ms} ms
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Refetches whatever the mock server holds now, changes included. */}
            <Button onClick={onReload}>Reload data</Button>
            <Button
              onClick={() => {
                onChange({ returnEmpty: true });
                onReload();
              }}
            >
              Load empty data
            </Button>
            {/* Back to the original 12 bookings and default switches. */}
            <Button onClick={onReset}>Reset demo data</Button>
          </div>
        </div>
      </details>
    </aside>
  );
}
