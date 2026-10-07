import type { RiskSignal } from '../types';

type SignalListProps = {
  /** Already sorted highest points first by scoreBooking. */
  signals: RiskSignal[];
};

/** Each rule that fired: what it is, the evidence for this booking, and its points. */
export function SignalList({ signals }: SignalListProps) {
  if (signals.length === 0) {
    return <p className="text-muted text-sm">No risk signals fired for this booking.</p>;
  }

  return (
    <ul aria-label="Risk signals" className="divide-line border-line divide-y rounded-md border">
      {signals.map((signal) => (
        <li key={signal.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-ink text-sm font-medium">{signal.label}</p>
            <p className="text-muted text-sm break-words">{signal.detail}</p>
          </div>
          <span className="text-ink shrink-0 text-sm font-semibold tabular-nums">
            +{signal.points}
          </span>
        </li>
      ))}
    </ul>
  );
}
