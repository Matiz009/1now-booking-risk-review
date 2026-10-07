import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  configureApi,
  getApiConfig,
  getBookings,
  resetApi,
  updateBookingStatus,
} from '../api/bookingsApi';
import { recommendAction } from '../lib/recommendAction';
import { DECLINE_REASON_MIN_LENGTH } from '../lib/risk.config';
import { scoreBooking } from '../lib/scoreBooking';
import { canTransition, nextStatuses } from '../lib/transitions';
import type {
  ApiConfig,
  Booking,
  BookingStatus,
  LoadStatus,
  ScoredBooking,
  UpdateOutcome,
} from '../types';

/**
 * The only place that talks to the API (CLAUDE.md rule 3). Loads bookings,
 * applies status changes optimistically, and rolls each one back on its own
 * if the server rejects it.
 */

type BookingsState = {
  bookings: Booking[];
  loadStatus: LoadStatus;
  loadError: string | null;
  /** Every booking with an update in flight. Its action buttons are disabled. */
  pendingIds: string[];
  /** The booking as it was before its in-flight update, keyed by id. */
  rollbacks: Record<string, Booking>;
};

/**
 * A discriminated union: every action has a `type` string, and inside
 * `case 'update_started':` TypeScript knows the action has `id`, `nextStatus`
 * and `declineReason`, and nothing else.
 */
type BookingsAction =
  | { type: 'load_started' }
  | { type: 'load_succeeded'; bookings: Booking[] }
  | { type: 'load_failed'; message: string }
  | {
      type: 'update_started';
      id: string;
      nextStatus: BookingStatus;
      declineReason: string | null;
      decidedAt: string | null;
    }
  | { type: 'update_succeeded'; booking: Booking }
  | { type: 'update_failed'; id: string };

const initialState: BookingsState = {
  bookings: [],
  loadStatus: 'loading',
  loadError: null,
  pendingIds: [],
  rollbacks: {},
};

function bookingsReducer(state: BookingsState, action: BookingsAction): BookingsState {
  switch (action.type) {
    case 'load_started':
      return { ...state, loadStatus: 'loading', loadError: null };

    case 'load_succeeded':
      // An empty list is a successful load, not an error. The page shows an empty state.
      return { ...state, bookings: action.bookings, loadStatus: 'ready', loadError: null };

    case 'load_failed':
      return { ...state, loadStatus: 'error', loadError: action.message };

    case 'update_started': {
      // The optimistic write: keep a snapshot, then show the new status at once.
      const current = state.bookings.find((booking) => booking.id === action.id);
      if (!current) {
        return state;
      }
      const optimistic: Booking = {
        ...current,
        status: action.nextStatus,
        declineReason: action.declineReason,
        decidedAt: action.decidedAt,
      };
      return {
        ...state,
        bookings: replaceBooking(state.bookings, optimistic),
        pendingIds: [...state.pendingIds, action.id],
        rollbacks: { ...state.rollbacks, [action.id]: current },
      };
    }

    case 'update_succeeded':
      // The server's copy wins, and the snapshot is no longer needed.
      return {
        ...state,
        bookings: replaceBooking(state.bookings, action.booking),
        pendingIds: state.pendingIds.filter((id) => id !== action.booking.id),
        rollbacks: withoutKey(state.rollbacks, action.booking.id),
      };

    case 'update_failed': {
      // The rollback: put back this booking's snapshot. Other in-flight updates
      // have their own snapshots and are left alone.
      const previous = state.rollbacks[action.id];
      return {
        ...state,
        bookings: previous ? replaceBooking(state.bookings, previous) : state.bookings,
        pendingIds: state.pendingIds.filter((id) => id !== action.id),
        rollbacks: withoutKey(state.rollbacks, action.id),
      };
    }
  }
}

export function useBookings() {
  const [state, dispatch] = useReducer(bookingsReducer, initialState);

  // Bumping this number re-runs the load effect. That's how Retry works.
  const [loadRequest, setLoadRequest] = useState(0);

  useEffect(() => {
    // Ignore a response that arrives after this effect was cleaned up, e.g. after
    // unmount, or in React's dev-only double run under StrictMode.
    let cancelled = false;

    getBookings().then(
      (bookings) => {
        if (!cancelled) {
          dispatch({ type: 'load_succeeded', bookings });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          dispatch({ type: 'load_failed', message: errorMessage(error) });
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [loadRequest]);

  // Demo-only: DevPanel changes the mock API's switches through here, so no
  // component imports the API module (CLAUDE.md rule 3). `useState(fn)` calls
  // `fn` once, on the first render only.
  const [apiSettings, setApiSettings] = useState<ApiConfig>(getApiConfig);

  const updateApiSettings = useCallback((next: Partial<ApiConfig>) => {
    configureApi(next);
    setApiSettings(getApiConfig());
  }, []);

  const reload = useCallback(() => {
    dispatch({ type: 'load_started' });
    setLoadRequest((n) => n + 1);
  }, []);

  /** Demo-only: the original 12 bookings and default switches, then a fresh load. */
  const resetDemo = useCallback(() => {
    resetApi();
    setApiSettings(getApiConfig());
    reload();
  }, [reload]);

  const updateStatus = useCallback(
    async (
      id: string,
      nextStatus: BookingStatus,
      declineReason: string | null = null,
    ): Promise<UpdateOutcome> => {
      const booking = state.bookings.find((b) => b.id === id);
      if (!booking) {
        return { ok: false, message: `Booking ${id} not found.` };
      }
      if (state.pendingIds.includes(id)) {
        return { ok: false, message: `Booking ${id} is still being updated.` };
      }
      if (!canTransition(booking.status, nextStatus)) {
        return { ok: false, message: `Booking ${id} can’t be changed to that status.` };
      }

      const reason = nextStatus === 'declined' ? (declineReason?.trim() ?? '') : null;
      if (reason !== null && reason.length < DECLINE_REASON_MIN_LENGTH) {
        return {
          ok: false,
          message: `Give a reason of at least ${DECLINE_REASON_MIN_LENGTH} characters to decline.`,
        };
      }

      // 1. Update state immediately. The row moves tabs before the API answers.
      // The optimistic decision time. The reducer stays pure, so the clock is
      // read here; the server's own time replaces it on success.
      const decidedAt = nextStatuses(nextStatus).length === 0 ? new Date().toISOString() : null;
      dispatch({ type: 'update_started', id, nextStatus, declineReason: reason, decidedAt });

      try {
        // 2. Ask the server.
        const saved = await updateBookingStatus(id, nextStatus, reason);
        dispatch({ type: 'update_succeeded', booking: saved });
        return { ok: true, message: MESSAGES[nextStatus].success(id) };
      } catch {
        // 3. It said no: roll back this booking only.
        dispatch({ type: 'update_failed', id });
        return {
          ok: false,
          message: `Couldn’t ${MESSAGES[nextStatus].verb(id)}. Change reverted.`,
        };
      }
    },
    [state.bookings, state.pendingIds],
  );

  // Risk is derived, never stored (CLAUDE.md rule 4). Recomputed only when the
  // bookings array changes, which is only when the reducer replaces it.
  const scoredBookings = useMemo<ScoredBooking[]>(
    () =>
      state.bookings.map((booking) => {
        const risk = scoreBooking(booking);
        return { booking, risk, recommendation: recommendAction(risk) };
      }),
    [state.bookings],
  );

  return {
    scoredBookings,
    loadStatus: state.loadStatus,
    loadError: state.loadError,
    pendingIds: state.pendingIds,
    reload,
    updateStatus,
    apiSettings,
    updateApiSettings,
    resetDemo,
  };
}

/** Toast text for each status an update can move a booking to. */
const MESSAGES: Record<
  BookingStatus,
  { success: (id: string) => string; verb: (id: string) => string }
> = {
  approved: { success: (id) => `${id} approved.`, verb: (id) => `approve ${id}` },
  declined: { success: (id) => `${id} declined.`, verb: (id) => `decline ${id}` },
  verification_requested: {
    success: (id) => `Verification requested for ${id}.`,
    verb: (id) => `request verification for ${id}`,
  },
  // No transition leads back here today, but the Record must cover every status.
  needs_review: {
    success: (id) => `${id} moved back to review.`,
    verb: (id) => `move ${id} back to review`,
  },
};

function replaceBooking(bookings: Booking[], next: Booking): Booking[] {
  return bookings.map((booking) => (booking.id === next.id ? next : booking));
}

function withoutKey(record: Record<string, Booking>, key: string): Record<string, Booking> {
  // Copy first: reducers must never change the state object they were given.
  const copy = { ...record };
  delete copy[key];
  return copy;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
