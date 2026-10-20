export type HashRoute = {
  /** Always starts with "/". "" and "#" both count as "/". */
  path: string;
  /** The part after "?", e.g. page=2. */
  params: URLSearchParams;
};

/**
 * "#/bookings?page=2" → { path: "/bookings", params: page=2 }. Pure, so the
 * parsing is tested without touching window.location.
 */
export function parseHash(hash: string): HashRoute {
  const withoutHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const [rawPath = '', query = ''] = withoutHash.split('?', 2);
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return { path, params: new URLSearchParams(query) };
}
