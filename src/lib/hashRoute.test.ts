import { describe, expect, it } from 'vitest';
import { parseHash } from './hashRoute';

describe('parseHash', () => {
  it('treats an empty hash, "#" and "#/" as the root', () => {
    expect(parseHash('').path).toBe('/');
    expect(parseHash('#').path).toBe('/');
    expect(parseHash('#/').path).toBe('/');
  });

  it('reads the path and the query', () => {
    const route = parseHash('#/bookings?page=2');
    expect(route.path).toBe('/bookings');
    expect(route.params.get('page')).toBe('2');
  });

  it('has no params when there is no query', () => {
    expect(parseHash('#/bookings').params.get('page')).toBeNull();
  });

  it('adds the leading slash when it is missing', () => {
    expect(parseHash('#bookings').path).toBe('/bookings');
  });

  it('passes an unknown path through unchanged', () => {
    expect(parseHash('#/nowhere').path).toBe('/nowhere');
  });
});
