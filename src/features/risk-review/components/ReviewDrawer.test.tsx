import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
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
      name: 'Suggested action · rule-based',
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

    // Inline error inside the drawer. No toast: the alert already announces it.
    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      'Couldn’t decline BK-1007. Your reason is kept; try again.',
    );
    expect(screen.queryByText(/Change reverted/)).not.toBeInTheDocument();

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

  it('disables the actions and labels the one being saved while the update is in flight', async () => {
    configureApi({ delayMs: 50 });
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Dana Whitfield');

    await user.click(within(drawer).getByRole('button', { name: /^Approve/ }));

    expect(within(drawer).getByRole('button', { name: 'Approving…' })).toBeDisabled();
    expect(within(drawer).getByRole('button', { name: 'Request verification' })).toBeDisabled();
    expect(within(drawer).getByRole('button', { name: 'Decline' })).toBeDisabled();
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

  it('is read-only for a final booking: when it was decided, the reason, no suggestion', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('tab', { name: /declined/i }));
    const drawer = await openBooking(user, 'Trent Yoakum');

    const decided = within(drawer).getByRole('region', { name: 'Decided' });
    expect(decided).toHaveTextContent(
      /^Decided\s*Declined .+\d{1,2}:\d{2}\s[AP]M\. This decision is final\./,
    );
    expect(within(decided).getByText('Reason:')).toBeInTheDocument();
    expect(
      within(drawer).queryByRole('region', { name: 'Suggested action · rule-based' }),
    ).not.toBeInTheDocument();
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

  it('suggests waiting on the renter once verification has been requested', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('tab', { name: /verification requested/i }));
    const drawer = await openBooking(user, 'Tovah Mercer');

    const suggestion = within(drawer).getByRole('region', {
      name: 'Suggested action · rule-based',
    });
    expect(suggestion).toHaveTextContent('Waiting on the renter');
    expect(suggestion).toHaveTextContent('Approve once they’re verified, or decline.');
    // Nothing to highlight: the next move is the renter's.
    expect(within(drawer).queryByRole('button', { name: /Recommended/ })).not.toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('explains a capped score when the signals add up to more than 100', async () => {
    const user = await renderLoaded();

    const capped = await openBooking(user, 'Victor Sandoval');
    expect(within(capped).getByText('100 / 100')).toBeInTheDocument();
    expect(within(capped).getByText('Signals total 130 · score capped at 100')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    const uncapped = await openBooking(user, 'Jordan Alcott');
    expect(within(uncapped).queryByText(/Signals total/)).not.toBeInTheDocument();
  });

  it('stays open, reason kept, when a toast or the demo controls are clicked', async () => {
    // jsdom has no stylesheet, so the pointer-events-auto classes that let the
    // toasts and demo controls past Radix's `pointer-events: none` on <body>
    // don't apply here. Skip user-event's pointer-events check; the browser
    // check covers the CSS.
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    render(<RiskReviewPage />);
    await screen.findByRole('tablist', { name: 'Booking status' });

    // Approving one booking leaves a success toast on screen to click later.
    const first = await openBooking(user, 'Dana Whitfield');
    await user.click(within(first).getByRole('button', { name: /^Approve/ }));
    await screen.findByText('BK-1001 approved.');

    const drawer = await openBooking(user, 'Jordan Alcott');
    const reasonText = 'Renter could not confirm identity by phone.';
    await user.click(within(drawer).getByRole('button', { name: 'Decline' }));
    await user.type(
      within(drawer).getByRole('textbox', { name: 'Reason for declining' }),
      reasonText,
    );

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('BK-1001 approved.')).not.toBeInTheDocument();

    const demo = screen.getByRole('complementary', { name: 'Demo controls' });
    const failUpdates = within(demo).getByRole('checkbox', { name: 'Fail status updates' });
    await user.click(failUpdates);
    expect(failUpdates).toBeChecked();

    expect(screen.getByRole('dialog', { name: 'Jordan Alcott' })).toBe(drawer);
    expect(within(drawer).getByRole('textbox', { name: 'Reason for declining' })).toHaveValue(
      reasonText,
    );
  });

  it('is modal: the page behind is hidden from screen readers, except demo controls and toasts', async () => {
    const user = await renderLoaded();

    const drawer = await openBooking(user, 'Jordan Alcott');

    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Demo controls' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
