import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureApi, resetApi } from '../api/bookingsApi';
import { AllBookingsPage } from './AllBookingsPage';

/** delayMs: 0 keeps every API call off the timer queue (see bookingsApi.ts). */
beforeEach(() => {
  resetApi();
  configureApi({ delayMs: 0 });
  window.location.hash = '#/bookings';
});

afterEach(() => {
  window.location.hash = '';
});

/**
 * Queries are scoped to the desktop table. The mobile cards hold the same
 * items; jsdom applies no CSS, so both are in the DOM.
 */
function table() {
  return within(screen.getByRole('table'));
}

/** Booking ids on the current page, in order. */
function pageIds(): string[] {
  return table()
    .getAllByRole('row')
    .map((row) => row.textContent?.match(/BK-\d{4}/)?.[0])
    .filter((id): id is string => id !== undefined);
}

/** Booking ids on the current page that show a problems alert. */
function alertIds(): string[] {
  return table()
    .queryAllByRole('button', { name: /^Show \d+ problems? for BK-\d{4}$/ })
    .map((button) => button.getAttribute('aria-label')?.match(/BK-\d{4}/)?.[0] ?? '');
}

async function renderLoaded() {
  render(<AllBookingsPage />);
  await screen.findByRole('table');
}

describe('AllBookingsPage', () => {
  it('shows a loading state, then the first page of 5', async () => {
    render(<AllBookingsPage />);

    expect(screen.getByRole('status', { name: 'Loading bookings' })).toBeInTheDocument();
    expect(await screen.findByText('Showing 1–5 of 12')).toBeInTheDocument();
    expect(pageIds()).toEqual(['BK-1001', 'BK-1002', 'BK-1003', 'BK-1004', 'BK-1005']);
  });

  it('spreads 12 bookings over 3 pages', async () => {
    await renderLoaded();
    const nav = within(screen.getByRole('navigation', { name: 'Pagination' }));

    expect(nav.getAllByRole('button', { name: /^Page \d$/ })).toHaveLength(3);
    expect(nav.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  });

  it('disables Prev on page 1 and Next on the last page', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const nav = within(screen.getByRole('navigation', { name: 'Pagination' }));

    expect(nav.getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(nav.getByRole('button', { name: 'Next' })).toBeEnabled();

    await user.click(nav.getByRole('button', { name: 'Page 3' }));

    expect(await screen.findByText('Showing 11–12 of 12')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/bookings?page=3');
    expect(nav.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(nav.getByRole('button', { name: 'Prev' })).toBeEnabled();
    expect(pageIds()).toEqual(['BK-1011', 'BK-1012']);
  });

  it('starts on the page named in the URL, and clamps one out of range', async () => {
    window.location.hash = '#/bookings?page=99';
    await renderLoaded();

    expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument();
  });

  it('shows alerts on exactly BK-1007, BK-1008, BK-1010 and BK-1012', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const nav = within(screen.getByRole('navigation', { name: 'Pagination' }));
    const seen: string[] = [];
    const flagged: string[] = [];

    for (const page of [1, 2, 3]) {
      await user.click(nav.getByRole('button', { name: `Page ${page}` }));
      await screen.findByText(new RegExp(`^Showing ${page * 5 - 4}–`));
      seen.push(...pageIds());
      flagged.push(...alertIds());
    }

    expect(seen).toHaveLength(12);
    expect(flagged).toEqual(['BK-1007', 'BK-1008', 'BK-1010', 'BK-1012']);
  });

  it('expands BK-1010’s problems to list its signals and capped score', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await screen.findByText('Showing 6–10 of 12');

    const alert = table().getByRole('button', { name: /for BK-1010$/ });
    expect(alert).toHaveTextContent(/problems/);
    expect(alert).toHaveAttribute('aria-expanded', 'false');

    await user.click(alert);

    expect(alert).toHaveAttribute('aria-expanded', 'true');
    const signals = table().getByRole('list', { name: 'Risk signals' });
    expect(within(signals).getByText('ID check failed')).toBeInTheDocument();
    expect(table().getByText(/Score 100/)).toHaveTextContent(/capped at 100/);

    await user.click(alert);

    expect(alert).toHaveAttribute('aria-expanded', 'false');
    expect(table().queryByRole('list', { name: 'Risk signals' })).not.toBeInTheDocument();
  });

  it('shows no alert on a low-risk booking', async () => {
    await renderLoaded();

    const row = table().getByText('BK-1001').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no bookings', async () => {
    configureApi({ returnEmpty: true });
    render(<AllBookingsPage />);

    expect(await screen.findByRole('heading', { name: 'No bookings yet' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error state with a working Retry', async () => {
    const user = userEvent.setup();
    configureApi({ failLoad: true });
    render(<AllBookingsPage />);

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('Couldn’t load bookings');

    configureApi({ failLoad: false });
    await user.click(within(error).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});
