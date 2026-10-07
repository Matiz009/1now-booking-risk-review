import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import { approveBlockedReason } from '../lib/recommendAction';
import { ACTION_LABELS, PENDING_ACTION_LABELS } from '../lib/statusLabels';
import { nextStatuses } from '../lib/transitions';
import type { BookingStatus, Recommendation, RecommendedAction } from '../types';

/** The status each recommendation points at. Waiting for an ID check points at none. */
const RECOMMENDED_STATUS: Record<RecommendedAction, BookingStatus | null> = {
  approve: 'approved',
  request_verification: 'verification_requested',
  decline: 'declined',
  wait_for_id: null,
  wait_for_renter: null,
};

type ActionBarProps = {
  /** The status to act from. Only moves transitions.ts allows become buttons. */
  status: BookingStatus;
  /** Status-fitted advice; null only for final bookings, which have no buttons. */
  recommendation: Recommendation | null;
  /** True while any update to this booking is in flight: every button is disabled. */
  isPending: boolean;
  /** The status being saved, if this drawer started it. That button says "Approving…" etc. */
  pendingStatus: BookingStatus | null;
  onAction: (next: BookingStatus) => void;
};

/**
 * The operator's decision. The recommended button is filled and labelled
 * "Recommended" (text, not just colour), but every allowed action stays
 * available: the recommendation is advice, not an action.
 */
export function ActionBar({
  status,
  recommendation,
  isPending,
  pendingStatus,
  onAction,
}: ActionBarProps) {
  const id = useId();
  const options = nextStatuses(status);
  const recommended = recommendation ? RECOMMENDED_STATUS[recommendation.action] : null;
  const approveBlocked = recommendation ? approveBlockedReason(recommendation) : null;

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" aria-busy={isPending}>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {options.map((next) => {
          const isRecommended = next === recommended;
          const isSaving = isPending && next === pendingStatus;
          const isBlocked = next === 'approved' && approveBlocked !== null;
          return (
            <Button
              key={next}
              variant={isRecommended ? (next === 'declined' ? 'danger' : 'primary') : 'secondary'}
              disabled={isPending || isBlocked}
              aria-describedby={isBlocked ? `${id}-blocked` : undefined}
              onClick={() => onAction(next)}
            >
              {isSaving ? PENDING_ACTION_LABELS[next] : ACTION_LABELS[next]}
              {isRecommended && !isSaving && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[0.6875rem] font-semibold">
                  Recommended
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {approveBlocked && options.includes('approved') && (
        <p id={`${id}-blocked`} className="text-muted text-sm">
          {approveBlocked}
        </p>
      )}
    </div>
  );
}
