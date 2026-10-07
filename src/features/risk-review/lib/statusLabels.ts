import type { BookingStatus } from '../types';

/** Tab order, left to right: the workflow from inbox to final. */
export const STATUS_ORDER: readonly BookingStatus[] = [
  'needs_review',
  'verification_requested',
  'approved',
  'declined',
];

/** One name per status, shared by the tabs and the status badges. */
export const STATUS_LABELS: Record<BookingStatus, string> = {
  needs_review: 'Needs review',
  verification_requested: 'Verification requested',
  approved: 'Approved',
  declined: 'Declined',
};

/** The button that moves a booking to each status. */
export const ACTION_LABELS: Record<BookingStatus, string> = {
  needs_review: 'Move back to review',
  verification_requested: 'Request verification',
  approved: 'Approve',
  declined: 'Decline',
};

/** What a button says while its change is saving. */
export const PENDING_ACTION_LABELS: Record<BookingStatus, string> = {
  needs_review: 'Moving…',
  verification_requested: 'Requesting…',
  approved: 'Approving…',
  declined: 'Declining…',
};

/** The DOM id of a status tab, so the tab panel can point back at it with aria-labelledby. */
export function statusTabId(status: BookingStatus): string {
  return `status-tab-${status}`;
}
