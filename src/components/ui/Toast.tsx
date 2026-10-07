import { cn } from '@/lib/cn';

export type ToastMessage = {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: string;
};

const TONE_CLASSES: Record<ToastMessage['tone'], string> = {
  success: 'border-l-emerald-600',
  error: 'border-l-red-600',
  info: 'border-l-slate-500',
};

const TONE_LABELS: Record<ToastMessage['tone'], string> = {
  success: 'Done',
  error: 'Error',
  info: 'Note',
};

type ToastProps = {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
};

/**
 * The toast region. It is always rendered, even when empty, because screen
 * readers only announce changes inside a live region that already existed.
 */
export function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-l-4 border-slate-200 bg-white p-3 shadow-lg',
            TONE_CLASSES[toast.tone],
          )}
        >
          <p className="flex-1 text-sm text-slate-900">
            <span className="font-semibold">{TONE_LABELS[toast.tone]}: </span>
            {toast.message}
          </p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
            className="-m-1 rounded p-1 text-slate-500 hover:text-slate-900"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
