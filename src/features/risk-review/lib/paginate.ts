/**
 * `<T>` makes this generic: it slices any kind of list, and the page it
 * returns keeps the item type it was given.
 */
export type PageOf<T> = {
  items: T[];
  /** The page actually shown, after clamping. 1-based. */
  page: number;
  /** At least 1, so an empty list is "page 1 of 1". */
  totalPages: number;
  /** 1-based position of the first item shown, for "Showing X–Y of N". 0 when empty. */
  start: number;
  /** 1-based position of the last item shown. 0 when empty. */
  end: number;
  total: number;
};

/**
 * One page of `items`. Pure, and never changes the array it was given.
 *
 * A page outside 1..totalPages is clamped rather than shown empty, so a stale
 * or hand-edited URL (?page=99, ?page=0, ?page=abc) still shows real rows.
 */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): PageOf<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number.isFinite(page) ? Math.floor(page) : 1;
  const current = Math.min(Math.max(requested, 1), totalPages);

  const startIndex = (current - 1) * pageSize;
  const pageItems = items.slice(startIndex, startIndex + pageSize);

  return {
    items: pageItems,
    page: current,
    totalPages,
    start: pageItems.length === 0 ? 0 : startIndex + 1,
    end: startIndex + pageItems.length,
    total,
  };
}
