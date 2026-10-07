import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { RiskLevel, RiskResult } from '../types';

const LEVEL_TONES: Record<RiskLevel, BadgeTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  unscored: 'neutral',
};

const LEVEL_DOTS: Record<RiskLevel, string> = {
  low: 'bg-risk-low',
  medium: 'bg-risk-medium',
  high: 'bg-risk-high',
  unscored: 'border border-slate-500 bg-transparent',
};

const LEVEL_LABELS: Record<Exclude<RiskLevel, 'unscored'>, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

type RiskBadgeProps = {
  risk: RiskResult;
};

/** "High risk · 90" or "ID check pending". The words carry the level; colour is a second cue. */
export function RiskBadge({ risk }: RiskBadgeProps) {
  const text =
    risk.level === 'unscored'
      ? 'ID check pending'
      : `${LEVEL_LABELS[risk.level]} risk · ${risk.score}`;

  return (
    <Badge tone={LEVEL_TONES[risk.level]}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', LEVEL_DOTS[risk.level])} />
      {text}
    </Badge>
  );
}
