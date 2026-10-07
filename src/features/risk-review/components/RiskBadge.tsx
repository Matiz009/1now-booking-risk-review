import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { RiskLevel, RiskResult } from '../types';

const LEVEL_TONES: Record<RiskLevel, BadgeTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  // Blue, a colour no risk level uses: pending is "not scored yet", not a level.
  unscored: 'info',
};

const LEVEL_DOTS: Record<Exclude<RiskLevel, 'unscored'>, string> = {
  low: 'bg-risk-low',
  medium: 'bg-risk-medium',
  high: 'bg-risk-high',
};

const LEVEL_LABELS: Record<Exclude<RiskLevel, 'unscored'>, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

type RiskBadgeProps = {
  risk: RiskResult;
};

/**
 * "High risk · 90" or "ID check pending". The words carry the level; colour is
 * a second cue. Pending is blue with a clock icon instead of a dot, so it can't
 * be mistaken for any risk level.
 */
export function RiskBadge({ risk }: RiskBadgeProps) {
  if (risk.level === 'unscored') {
    return (
      <Badge tone={LEVEL_TONES.unscored}>
        <ClockIcon />
        ID check pending
      </Badge>
    );
  }

  return (
    <Badge tone={LEVEL_TONES[risk.level]}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', LEVEL_DOTS[risk.level])} />
      {`${LEVEL_LABELS[risk.level]} risk · ${risk.score}`}
    </Badge>
  );
}

/** Decorative: the badge text already says "pending", so screen readers skip it. */
function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="size-3"
    >
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75V8l2.25 1.5" />
    </svg>
  );
}
