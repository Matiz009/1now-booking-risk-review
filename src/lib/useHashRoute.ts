import { useMemo, useSyncExternalStore } from 'react';
import { parseHash, type HashRoute } from './hashRoute';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function getHash(): string {
  return window.location.hash;
}

/**
 * The current hash route, e.g. { path: "/bookings", params: page=2 }.
 *
 * `useSyncExternalStore` is React's built-in way to read a value that lives
 * outside React (here the URL): it re-renders whenever `hashchange` fires.
 * Every hash change is a history entry, so Back and Forward work for free.
 */
export function useHashRoute(): HashRoute {
  const hash = useSyncExternalStore(subscribe, getHash);
  return useMemo(() => parseHash(hash), [hash]);
}
