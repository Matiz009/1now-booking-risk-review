import type { RiskSignal } from '../types';

type SignalListProps = {
  /** Already sorted highest points first by scoreBooking. */
  signals: RiskSignal[];
};

/** Each rule that fired: what it is, the evidence for this booking, and its points. */
export function SignalList({ signals }: SignalListProps) {
  if (signals.length === 0) {
    return <p className="text-sm text-slate-600">No risk signals fired for this booking.</p>;
  }

  return (
    <ul
      aria-label="Risk signals"
      className="divide-y divide-slate-100 rounded-md border border-slate-200"
    >
      {signals.map((signal) => (
        <li key={signal.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{signal.label}</p>
            <p className="text-sm break-words text-slate-600">{signal.detail}</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
            +{signal.points}
          </span>
        </li>
      ))}
    </ul>
  );
}
