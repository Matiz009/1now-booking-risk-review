import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureApi, resetApi } from '../api/bookingsApi';
import { mockBookings } from '../data/bookings.mock';
import { RiskReviewPage } from './RiskReviewPage';

/** delayMs: 0 keeps every API call off the timer queue (see bookingsApi.ts). */
beforeEach(() => {
  resetApi();
  configureApi({ delayMs: 0 });
});

/** Renders the page and waits for the queue to appear. */
async function renderLoaded() {
  render(<RiskReviewPage />);
  return screen.findByRole('tablist', { name: 'Booking status' });
}

/**
 * Booking ids in on-screen order, read from the desktop table. The mobile
 * cards hold the same items; jsdom applies no CSS, so both are in the DOM.
 */
function tableOrder(): string[] {
  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1); // skip the header
  return rows.map((row) => row.textContent?.match(/BK-\d{4}/)?.[0] ?? '');
}

describe('RiskReviewPage', () => {
  it('shows a loading state, then the queue', async () => {
    render(<RiskReviewPage />);

    expect(screen.getByRole('status', { name: 'Loading bookings' })).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading bookings' })).not.toBeInTheDocument();
  });

  it('labels every tab with its booking count', async () => {
    await renderLoaded();

    expect(screen.getByRole('tab', { name: 'Needs review 9' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Verification requested 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Approved 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Declined 1' })).toBeInTheDocument();
  });

  it('sorts Needs review: unscored first, then highest score, then earliest pickup', async () => {
    await renderLoaded();

    expect(tableOrder()).toEqual([
      'BK-1009', // ID check pending: pinned to the top
      'BK-1010', // 100 (capped)
      'BK-1008', // 90
      'BK-1007', // 65
      'BK-1006', // 45
      'BK-1004', // 25
      'BK-1003', // 10, pickup sooner than BK-1002's
      'BK-1002', // 10
      'BK-1001', // 0
    ]);
  });

  it('shows each risk as text, not only colour', async () => {
    await renderLoaded();
    const table = screen.getByRole('table');

    expect(within(table).getByText('ID check pending')).toBeInTheDocument();
    expect(within(table).getByText('High risk · 100')).toBeInTheDocument();
    expect(within(table).getByText('Medium risk · 45')).toBeInTheDocument();
    expect(within(table).getByText('Low risk · 0')).toBeInTheDocument();
  });

  it('opens a booking from the renter button, with one Tab stop per row', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const table = screen.getByRole('table');
    const renterButton = within(table).getByRole('button', { name: 'Noor Haddad' });
    const row = renterButton.closest('tr')!;

    // The row itself is not a Tab stop; the renter button is its only one.
    expect(row).not.toHaveAttribute('tabindex');
    expect(within(row).getAllByRole('button')).toHaveLength(1);

    renterButton.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('dialog', { name: 'Noor Haddad' })).toBeInTheDocument();
  });

  it('opens each booking exactly once when its renter button is clicked', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const table = screen.getByRole('table');

    await user.click(within(table).getByRole('button', { name: 'Victor Sandoval' }));

    // The click bubbles to the row's handler; it must not also fire a second time.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Victor Sandoval' })).toBeInTheDocument();
  });

  it('explains the queue order above the list', async () => {
    await renderLoaded();

    expect(
      screen.getByText('Sorted by risk · bookings awaiting ID checks first'),
    ).toBeInTheDocument();
  });

  it('shows the sort hint only on the Needs review tab', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole('tab', { name: /declined/i }));

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText(/Sorted by risk/)).not.toBeInTheDocument();
  });

  it('switches tabs and shows only that status', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole('tab', { name: /declined/i }));

    expect(screen.getByRole('tab', { name: /declined/i })).toHaveAttribute('aria-selected', 'true');
    expect(tableOrder()).toEqual(['BK-1012']);
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    await renderLoaded();

    screen.getByRole('tab', { name: /needs review/i }).focus();
    await user.keyboard('{ArrowRight}');

    const verification = screen.getByRole('tab', { name: /verification requested/i });
    expect(verification).toHaveFocus();
    expect(verification).toHaveAttribute('aria-selected', 'true');
  });

  it('shows a tab-specific empty state for an empty tab', async () => {
    resetApi(mockBookings.filter((b) => b.status !== 'approved'));
    configureApi({ delayMs: 0 });
    const user = userEvent.setup();
    await renderLoaded();

    await user.click(screen.getByRole('tab', { name: 'Approved 0' }));

    const panel = screen.getByRole('tabpanel');
    expect(
      within(panel).getByRole('heading', { name: 'No approved bookings' }),
    ).toBeInTheDocument();
    expect(within(panel).queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error with a Retry that recovers', async () => {
    configureApi({ failLoad: true });
    const user = userEvent.setup();
    render(<RiskReviewPage />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Couldn’t load bookings' })).toBeVisible();
    // The hook's loadError, shown as the message.
    expect(
      within(alert).getByText('The server didn’t respond. Check your connection and try again.'),
    ).toBeVisible();

    configureApi({ failLoad: false });
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // Keyboard users land on the selected tab, not at the top of the page.
    expect(screen.getByRole('tab', { name: /needs review/i })).toHaveFocus();
  });

  it('lets the demo controls force a load failure', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const demo = screen.getByRole('complementary', { name: 'Demo controls' });

    await user.click(within(demo).getByRole('checkbox', { name: 'Fail loading bookings' }));
    await user.click(within(demo).getByRole('button', { name: 'Reload data' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load bookings');
  });

  it('lets the demo controls load an empty queue, and reload the sample data', async () => {
    const user = userEvent.setup();
    await renderLoaded();
    const demo = screen.getByRole('complementary', { name: 'Demo controls' });

    await user.click(within(demo).getByRole('button', { name: 'Load empty data' }));

    expect(await screen.findByRole('heading', { name: 'Nothing to review' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Needs review 0' })).toBeInTheDocument();

    await user.click(within(demo).getByRole('button', { name: 'Reload data' }));

    expect(await screen.findByRole('tab', { name: 'Needs review 9' })).toBeInTheDocument();
  });
});
