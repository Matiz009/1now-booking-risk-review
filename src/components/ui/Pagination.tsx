import { Button } from './Button';

type PaginationProps = {
  /** 1-based. */
  page: number;
  totalPages: number;
  /** 1-based positions of the first and last item shown, and the item count. */
  start: number;
  end: number;
  total: number;
  onPageChange: (page: number) => void;
};

/** "Showing 6–10 of 12", then Prev, numbered pages and Next. Prev/Next disable at the ends. */
export function Pagination({ page, totalPages, start, end, total, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted">
        Showing {start}–{end} of {total}
      </p>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Prev
          </Button>
        </li>
        {pages.map((number) => (
          <li key={number}>
            <Button
              variant={number === page ? 'primary' : 'secondary'}
              aria-label={`Page ${number}`}
              aria-current={number === page ? 'page' : undefined}
              onClick={() => onPageChange(number)}
              className="min-w-9"
            >
              {number}
            </Button>
          </li>
        ))}
        <li>
          <Button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Next
          </Button>
        </li>
      </ul>
    </nav>
  );
}
