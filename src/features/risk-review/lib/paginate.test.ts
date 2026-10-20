import { describe, expect, it } from 'vitest';
import { paginate } from './paginate';

/** 12 items, like the mock bookings: pages of 5, 5 and 2. */
const twelve = Array.from({ length: 12 }, (_, index) => index + 1);

describe('paginate', () => {
  it('returns the first page', () => {
    expect(paginate(twelve, 1, 5)).toEqual({
      items: [1, 2, 3, 4, 5],
      page: 1,
      totalPages: 3,
      start: 1,
      end: 5,
      total: 12,
    });
  });

  it('returns a middle page', () => {
    const result = paginate(twelve, 2, 5);
    expect(result.items).toEqual([6, 7, 8, 9, 10]);
    expect([result.start, result.end]).toEqual([6, 10]);
  });

  it('returns a partial last page', () => {
    const result = paginate(twelve, 3, 5);
    expect(result.items).toEqual([11, 12]);
    expect(result.page).toBe(3);
    expect([result.start, result.end]).toEqual([11, 12]);
  });

  it('has exactly one page when the items fill it', () => {
    expect(paginate([1, 2, 3, 4, 5], 1, 5).totalPages).toBe(1);
  });

  it('clamps a page past the end to the last page', () => {
    const result = paginate(twelve, 99, 5);
    expect(result.page).toBe(3);
    expect(result.items).toEqual([11, 12]);
  });

  it('clamps page 0 and negative pages to the first page', () => {
    expect(paginate(twelve, 0, 5).page).toBe(1);
    expect(paginate(twelve, -3, 5).page).toBe(1);
  });

  it('treats a non-number page (e.g. ?page=abc) as the first page', () => {
    expect(paginate(twelve, Number('abc'), 5).page).toBe(1);
  });

  it('rounds a fractional page down', () => {
    expect(paginate(twelve, 2.7, 5).page).toBe(2);
  });

  it('shows an empty list as page 1 of 1 with nothing in it', () => {
    expect(paginate([], 4, 5)).toEqual({
      items: [],
      page: 1,
      totalPages: 1,
      start: 0,
      end: 0,
      total: 0,
    });
  });

  it('does not change the array it was given', () => {
    const input = [1, 2, 3];
    paginate(input, 1, 2);
    expect(input).toEqual([1, 2, 3]);
  });
});
