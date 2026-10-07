import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureApi, resetApi } from '../api/bookingsApi';
import { RiskReviewPage } from './RiskReviewPage';

/**
 * The critical review flow, driven through the whole page the way an operator
 * would: open a booking, read it, act on it. delayMs: 0 keeps the mock API off
 * the timer queue.
 */
beforeEach(() => {
  resetApi();
  configureApi({ delayMs: 0 });
});

type User = ReturnType<typeof userEvent.setup>;

async function renderLoaded(): Promise<User> {
  const user = userEvent.setup();
  render(<RiskReviewPage />);
  await screen.findByRole('tablist', { name: 'Booking status' });
  return user;
}

/** The renter button in the desktop table (jsdom applies no CSS, so the cards exist too). */
function renterButton(name: string) {
  return within(screen.getByRole('table')).getByRole('button', { name });
}

async function openBooking(user: User, renter: string) {
  await user.click(renterButton(renter));
  return screen.findByRole('dialog', { name: renter });
}

describe('Review drawer', () => {
  it('shows the booking, its signals highest first, and the recommendation', async () => {
    const user = await renderLoaded();

    const drawer = await openBooking(user, 'Jordan Alcott');

    expect(within(drawer).getByText('BK-1007')).toBeInTheDocument();
    expect(within(drawer).getByText('High risk · 65')).toBeInTheDocument();
    expect(within(drawer).getByText('65 / 100')).toBeInTheDocument();

    const signals = within(within(drawer).getByRole('list', { name: 'Risk signals' })).getAllByRole(
      'listitem',
    );
    const points = signals.map((item) => Number(item.textContent?.match(/\+(\d+)$/)?.[1]));
    expect(points).toEqual([...points].sort((a, b) => b - a));
    expect(points.reduce((sum, p) => sum + p, 0)).toBe(65);

    const suggestion = within(drawer).getByRole('region', {
      name: 'Carisma-style suggestion · rule-based',
    });
    expect(within(suggestion).getByText('Request verification')).toBeInTheDocument();
    expect(
      within(drawer).getByRole('button', { name: /Request verification.*Recommended/ }),
    ).toBeInTheDocument();
  });

  it('blocks a decline whose reason is too short', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Jordan Alcott');

    await user.click(within(drawer).getByRole('button', { name: 'Decline' }));
    const reason = within(drawer).getByRole('textbox', { name: 'Reason for declining' });
    await user.type(reason, 'Too short');
    expect(within(drawer).getByText('9 / 10 characters minimum')).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Confirm decline' }));

    expect(within(drawer).getByRole('alert')).toHaveTextContent('Enter at least 10 characters');
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // The page behind the modal is aria-hidden, hence `hidden: true`.
    expect(screen.getByRole('tab', { name: 'Declined 1', hidden: true })).toBeInTheDocument();
  });

  it('declines with a valid reason: the booking moves to Declined with a success toast', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Jordan Alcott');

    await user.click(within(drawer).getByRole('button', { name: 'Decline' }));
    await user.type(
      within(drawer).getByRole('textbox', { name: 'Reason for declining' }),
      'Renter could not confirm identity by phone.',
    );
    await user.click(within(drawer).getByRole('button', { name: 'Confirm decline' }));

    expect(await screen.findByText('BK-1007 declined.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Needs review 8' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Declined 2' }));
    expect(renterButton('Jordan Alcott')).toBeInTheDocument();
  });

  it('keeps the drawer open with the reason and an inline error when the update fails', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('checkbox', { name: 'Fail status updates' }));
    const drawer = await openBooking(user, 'Jordan Alcott');
    const reasonText = 'Renter could not confirm identity by phone.';

    await user.click(within(drawer).getByRole('button', { name: 'Decline' }));
    await user.type(
      within(drawer).getByRole('textbox', { name: 'Reason for declining' }),
      reasonText,
    );
    await user.click(within(drawer).getByRole('button', { name: 'Confirm decline' }));

    // Inline error inside the drawer, and the toast as well.
    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      'Couldn’t decline BK-1007. Your reason is kept; try again.',
    );
    expect(screen.getByText('Couldn’t decline BK-1007. Change reverted.')).toBeInTheDocument();

    // The drawer stays open, with the reason still typed and the actions live again.
    expect(screen.getByRole('dialog', { name: 'Jordan Alcott' })).toBe(drawer);
    expect(within(drawer).getByRole('textbox', { name: 'Reason for declining' })).toHaveValue(
      reasonText,
    );
    expect(within(drawer).getByRole('button', { name: 'Confirm decline' })).toBeEnabled();
    expect(within(drawer).getByText('Needs review')).toBeInTheDocument();

    // Behind the modal (aria-hidden, hence `hidden: true`) it's back in Needs review.
    expect(screen.getByRole('tab', { name: 'Needs review 9', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Declined 1', hidden: true })).toBeInTheDocument();
  });

  it('disables the actions and shows a pending state while the update is in flight', async () => {
    configureApi({ delayMs: 50 });
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Dana Whitfield');

    await user.click(within(drawer).getByRole('button', { name: /^Approve/ }));

    expect(within(drawer).getByText('Saving change…')).toBeInTheDocument();
    for (const button of within(drawer).getAllByRole('button', {
      name: /Approve|Request verification|Decline/,
    })) {
      expect(button).toBeDisabled();
    }
    expect(await screen.findByText('BK-1001 approved.')).toBeInTheDocument();
  });

  it('disables Approve for BK-1009 while its ID check is pending, with the reason shown', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Noor Haddad');

    const approve = within(drawer).getByRole('button', { name: 'Approve' });
    expect(approve).toBeDisabled();
    expect(
      within(drawer).getByText('Approve is unavailable until the ID check returns.'),
    ).toBeVisible();
    expect(approve).toHaveAccessibleDescription(
      'Approve is unavailable until the ID check returns.',
    );
    // The other choices stay open to the operator.
    expect(within(drawer).getByRole('button', { name: 'Request verification' })).toBeEnabled();
    expect(within(drawer).getByRole('button', { name: 'Decline' })).toBeEnabled();

    // No score until the ID check is back; the raw facts instead.
    expect(within(drawer).getByText('Risk score pending ID check')).toBeInTheDocument();
    expect(within(drawer).queryByText(/\/ 100/)).not.toBeInTheDocument();
    expect(within(drawer).getByText('Past trips')).toBeInTheDocument();
  });

  it('is read-only for a final booking and shows the decline reason', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('tab', { name: /declined/i }));
    const row = within(screen.getByRole('table')).getAllByRole('row')[1]!;
    await user.click(within(row).getByRole('button'));

    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText(/This decision is final/)).toBeInTheDocument();
    expect(within(drawer).getByText('Reason:')).toBeInTheDocument();
    expect(
      within(drawer).queryByRole('button', { name: /Approve|Decline|Request verification/ }),
    ).not.toBeInTheDocument();
  });

  it('closes on Esc and returns focus to the renter button', async () => {
    const user = await renderLoaded();
    renterButton('Jordan Alcott').focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('dialog', { name: 'Jordan Alcott' });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(renterButton('Jordan Alcott')).toHaveFocus());
  });

  it('returns focus to the renter button after a row click and the close button', async () => {
    const user = await renderLoaded();
    const row = renterButton('Jordan Alcott').closest('tr')!;
    await user.click(within(row).getByText('BK-1007'));
    const drawer = await screen.findByRole('dialog', { name: 'Jordan Alcott' });

    await user.click(within(drawer).getByRole('button', { name: 'Close review' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(renterButton('Jordan Alcott')).toHaveFocus());
  });
});
