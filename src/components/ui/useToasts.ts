import { useCallback, useRef, useState } from 'react';
import type { ToastMessage } from './Toast';

/**
 * The list of toasts on screen. Each toast dismisses itself on a timer (see
 * Toast.tsx); this hook only adds and removes them.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // Clears every toast of one tone at once, e.g. old success messages that
  // would sit on top of a drawer that has just opened.
  const dismissTone = useCallback((tone: ToastMessage['tone']) => {
    setToasts((current) => current.filter((toast) => toast.tone !== tone));
  }, []);

  const showToast = useCallback((tone: ToastMessage['tone'], message: string) => {
    const id = nextId.current++;
    // A toast with the same text replaces the old one instead of stacking a
    // duplicate. The new id remounts it, so its timer starts again from full.
    setToasts((current) => [
      ...current.filter((toast) => toast.message !== message),
      { id, tone, message },
    ]);
  }, []);

  return { toasts, showToast, dismissToast, dismissTone };
}
