import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import type { ApiConfig } from '../types';

const DELAY_OPTIONS = [0, 600, 2000];

type DevPanelProps = {
  settings: ApiConfig;
  onChange: (next: Partial<ApiConfig>) => void;
  onReload: () => void;
};

/**
 * Demo-only switches for the mock API, so failures and slow networks can be
 * shown on purpose. It's styled as a dashed, striped box so nobody mistakes
 * it for part of the product. `useId` gives each input a unique id for its <label>.
 */
export function DevPanel({ settings, onChange, onReload }: DevPanelProps) {
  const id = useId();

  return (
    <aside
      aria-labelledby={`${id}-heading`}
      className="rounded-lg border-2 border-dashed border-amber-400 bg-[repeating-linear-gradient(135deg,var(--color-amber-50)_0_12px,var(--color-white)_12px_24px)] p-4"
    >
      <h2 id={`${id}-heading`} className="text-sm font-semibold text-amber-900">
        Demo controls
      </h2>
      <p className="mt-0.5 text-xs text-amber-900/80">
        Not part of the product. These switches simulate the API for the demo.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
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

        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button
            onClick={() => {
              onChange({ returnEmpty: true });
              onReload();
            }}
          >
            Load empty data
          </Button>
          {/* Always loads the sample bookings, so it also undoes "Load empty data". */}
          <Button
            onClick={() => {
              onChange({ returnEmpty: false });
              onReload();
            }}
          >
            Reload data
          </Button>
        </div>
      </div>
    </aside>
  );
}
