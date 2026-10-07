import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { cn } from '@/lib/cn';

export type ToastMessage = {
  id: number;
  tone: 'success' | 'error' | 'info';
  message: string;
};

/** How long a toast stays up while nobody is hovering over or focused on it. */
export const TOAST_DURATION_MS = 5000;

const TONE_CLASSES: Record<ToastMessage['tone'], string> = {
  success: 'border-l-emerald-600',
  error: 'border-l-red-600',
  info: 'border-l-subtle',
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
 *
 * z-50 puts it above the review drawer's overlay (z-40), and each toast has
 * pointer-events-auto because Radix sets pointer-events: none on <body> while
 * the drawer is open. Screen readers still reach it then: the aria-hidden
 * package Radix uses never hides an element with aria-live. On phones it sits
 * at the top, clear of the demo controls in the bottom-left corner.
 */
export function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-4 sm:top-auto sm:bottom-0 sm:items-end"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

type ToastItemProps = {
  toast: ToastMessage;
  onDismiss: (id: number) => void;
};

/**
 * One toast with its own auto-dismiss timer. The timer pauses while the
 * pointer is over the toast or focus is inside it, so nobody loses a message
 * they're reading or about to dismiss, and resumes with the time that was left.
 */
function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isPaused = isHovered || isFocused;

  // A ref, not state: changing it must not re-render. It only carries the time
  // left from one run of the effect to the next.
  const remainingMs = useRef(TOAST_DURATION_MS);

  useEffect(() => {
    if (isPaused) {
      return;
    }
    const startedAt = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remainingMs.current);
    // Runs when the toast pauses (isPaused changes) or unmounts: stop the timer
    // and remember how much of it was still to run.
    return () => {
      window.clearTimeout(timer);
      remainingMs.current -= Date.now() - startedAt;
    };
  }, [isPaused, onDismiss, toast.id]);

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // Focus moving between elements inside the toast doesn't count as leaving it.
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsFocused(false);
    }
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      className={cn(
        'border-line pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border border-l-4 bg-white p-3 shadow-lg',
        TONE_CLASSES[toast.tone],
      )}
    >
      <p className="text-ink flex-1 text-sm">
        <span className="font-semibold">{TONE_LABELS[toast.tone]}: </span>
        {toast.message}
      </p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="text-subtle hover:bg-surface-alt hover:text-ink -my-1.5 -mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded text-lg leading-none"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
