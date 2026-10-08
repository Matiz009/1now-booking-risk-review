/**
 * A decline reason's length as the operator sees it: trimmed, and counted in
 * characters rather than UTF-16 code units, so "🚗" counts as 1, not 2.
 * Spreading a string (`[...text]`) splits it into code points, which is what
 * makes that work. The form, the hook and the mock API all use this one rule.
 */
export function declineReasonLength(reason: string): number {
  return [...reason.trim()].length;
}
