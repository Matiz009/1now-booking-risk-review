import { MAX_SCORE } from '../lib/risk.config';
import { uncappedScore } from '../lib/suspicion';
import type { RiskResult } from '../types';
import { SignalList } from './SignalList';

type ProblemsDetailsProps = {
  /** Matches the ProblemsButton's `aria-controls`. */
  id: string;
  risk: RiskResult;
};

/** What a ProblemsButton expands: each signal with its evidence and points, then the score. */
export function ProblemsDetails({ id, risk }: ProblemsDetailsProps) {
  const total = uncappedScore(risk);

  return (
    <div id={id} className="space-y-2">
      <SignalList signals={risk.signals} />
      <p className="text-ink text-sm font-medium">
        Score {risk.score}
        {total > MAX_SCORE && (
          <span className="text-muted font-normal">
            {` · signals add up to ${total}, capped at ${MAX_SCORE}`}
          </span>
        )}
      </p>
    </div>
  );
}
