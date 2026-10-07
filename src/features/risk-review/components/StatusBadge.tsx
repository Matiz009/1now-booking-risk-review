import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { STATUS_LABELS } from '../lib/statusLabels';
import type { BookingStatus } from '../types';

const STATUS_TONES: Record<BookingStatus, BadgeTone> = {
  needs_review: 'neutral',
  verification_requested: 'info',
  approved: 'success',
  declined: 'danger',
};

type StatusBadgeProps = {
  status: BookingStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
