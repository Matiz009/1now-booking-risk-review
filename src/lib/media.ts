/**
 * True when a CSS media query matches the window right now. Only pass
 * `min-width` queries: where matchMedia doesn't exist (jsdom in tests), the
 * screen counts as wide and every query matches.
 */
export function matchesMedia(query: string): boolean {
  return typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : true;
}
