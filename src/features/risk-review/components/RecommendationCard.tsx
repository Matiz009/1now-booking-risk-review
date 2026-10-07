import { useId } from 'react';
import type { Recommendation } from '../types';

type RecommendationCardProps = {
  recommendation: Recommendation;
};

/**
 * The engine's advice, labelled as such. It never acts: the operator picks an
 * action in the ActionBar, and can ignore this entirely.
 */
export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const id = useId();

  return (
    <section
      aria-labelledby={`${id}-label`}
      className="rounded-md border border-indigo-200 bg-indigo-50 p-3"
    >
      <p id={`${id}-label`} className="text-xs font-medium text-indigo-800">
        Suggested action · rule-based
      </p>
      <p className="mt-1 text-base font-semibold text-slate-900">{recommendation.headline}</p>
      <p className="mt-0.5 text-sm text-slate-700">{recommendation.rationale}</p>
    </section>
  );
}
