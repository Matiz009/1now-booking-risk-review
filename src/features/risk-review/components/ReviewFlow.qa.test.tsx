import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { configureApi, resetApi } from '../api/bookingsApi';
import { mockBookings } from '../data/bookings.mock';
import { RiskReviewPage } from './RiskReviewPage';

/**
 * QA additions: the operator flows TEST_CASES.md marked as gaps, driven through
 * the whole page by role, label and text. delayMs: 0 unless a test needs to
 * see the in-flight state.
 */

beforeEach(() => {
  resetApi();
  configureApi({ delayMs: 0 });
});

type User = ReturnType<typeof userEvent.setup>;

const VALID_REASON = 'Renter could not confirm identity by phone.';

async function renderLoaded(options: Parameters<typeof userEvent.setup>[0] = {}): Promise<User> {
  const user = userEvent.setup(options);
  render(<RiskReviewPage />);
  await screen.findByRole('tablist', { name: 'Booking status' });
  return user;
}

/** The renter button in the desktop table. jsdom applies no CSS, so the cards exist too. */
function renterButton(name: string) {
  return within(screen.getByRole('table')).getByRole('button', { name });
}

async function openBooking(user: User, renter: string) {
  await user.click(renterButton(renter));
  return screen.findByRole('dialog', { name: renter });
}

/** A tab by its full name, e.g. "Declined 2". Works while the modal hides the page. */
function tab(name: string) {
  return screen.getByRole('tab', { name, hidden: true });
}

function expectCounts(review: number, verification: number, approved: number, declined: number) {
  expect(tab(`Needs review ${review}`)).toBeInTheDocument();
  expect(tab(`Verification requested ${verification}`)).toBeInTheDocument();
  expect(tab(`Approved ${approved}`)).toBeInTheDocument();
  expect(tab(`Declined ${declined}`)).toBeInTheDocument();
}

async function startDecline(user: User, drawer: HTMLElement, reason: string) {
  await user.click(within(drawer).getByRole('button', { name: /^Decline/ }));
  const box = within(drawer).getByRole('textbox', { name: 'Reason for declining' });
  await user.click(box);
  await user.paste(reason);
  return box;
}

function confirmDecline(user: User, drawer: HTMLElement) {
  return user.click(within(drawer).getByRole('button', { name: 'Confirm decline' }));
}

describe('Recommendations in the drawer', () => {
  it('RC-08, TR-07: a verification-requested booking offers only Approve and Decline', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('tab', { name: /verification requested/i }));
    const drawer = await openBooking(user, 'Tovah Mercer');

    const footerButtons = within(drawer)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(footerButtons).toContain('Approve');
    expect(footerButtons).toContain('Decline');
    expect(
      within(drawer).queryByRole('button', { name: /Request verification/ }),
    ).not.toBeInTheDocument();
  });

  it('RC-09: verification requested with the ID still pending keeps Approve disabled', async () => {
    resetApi(
      mockBookings.map((b) =>
        b.id === 'BK-1009' ? { ...b, status: 'verification_requested' as const } : b,
      ),
    );
    configureApi({ delayMs: 0 });
    const user = await renderLoaded();
    await user.click(screen.getByRole('tab', { name: /verification requested/i }));
    const drawer = await openBooking(user, 'Noor Haddad');

    const suggestion = within(drawer).getByRole('region', {
      name: 'Suggested action · rule-based',
    });
    expect(suggestion).toHaveTextContent('Wait for ID check');
    expect(within(drawer).getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(
      within(drawer).getByText('Approve is unavailable until the ID check returns.'),
    ).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Decline' })).toBeEnabled();
  });

  it('RC-10, TR-08: an approved booking is read-only with no suggestion and no reason', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('tab', { name: /approved/i }));
    const drawer = await openBooking(user, 'Amelia Choi');

    const decided = within(drawer).getByRole('region', { name: 'Decided' });
    expect(decided).toHaveTextContent(/Approved .+\. This decision is final\./);
    expect(within(decided).queryByText('Reason:')).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole('region', { name: 'Suggested action · rule-based' }),
    ).not.toBeInTheDocument();
    expect(
      within(drawer)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['×']);
  });

  it('RC-11: a decline suggestion marks the Decline button "Recommended" in text', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Ryan Kessel');

    expect(within(drawer).getByRole('button', { name: /^Decline\s*Recommended$/ })).toBeEnabled();
    expect(within(drawer).getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('RC-12: the operator can approve a booking the engine says to decline', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Ryan Kessel');

    await user.click(within(drawer).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('BK-1008 approved.')).toBeInTheDocument();
    expectCounts(8, 1, 2, 1);
  });

  it('RC-13: the operator can ask to verify a booking the engine says to approve', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Dana Whitfield');

    await user.click(within(drawer).getByRole('button', { name: 'Request verification' }));

    expect(await screen.findByText('Verification requested for BK-1001.')).toBeInTheDocument();
    expectCounts(8, 2, 1, 1);
  });
});

describe('Transitions through the UI', () => {
  it('TR-10, AC-02: review → verification requested → approved, then read-only', async () => {
    const user = await renderLoaded();
    const first = await openBooking(user, 'Jordan Alcott');
    await user.click(within(first).getByRole('button', { name: /^Request verification/ }));
    await screen.findByText('Verification requested for BK-1007.');
    expectCounts(8, 2, 1, 1);

    await user.click(screen.getByRole('tab', { name: 'Verification requested 2' }));
    const second = await openBooking(user, 'Jordan Alcott');
    await user.click(within(second).getByRole('button', { name: 'Approve' }));
    await screen.findByText('BK-1007 approved.');
    expectCounts(8, 1, 2, 1);

    await user.click(screen.getByRole('tab', { name: 'Approved 2' }));
    const final = await openBooking(user, 'Jordan Alcott');
    expect(within(final).getByRole('region', { name: 'Decided' })).toHaveTextContent(
      'This decision is final.',
    );
  });

  it('TR-11: declining from Verification requested still needs a reason', async () => {
    const user = await renderLoaded();
    await user.click(screen.getByRole('tab', { name: /verification requested/i }));
    const drawer = await openBooking(user, 'Tovah Mercer');

    await user.click(within(drawer).getByRole('button', { name: 'Decline' }));
    await confirmDecline(user, drawer);
    expect(within(drawer).getByRole('alert')).toHaveTextContent('Enter at least 10 characters');
    expectCounts(9, 1, 1, 1);

    await user.type(
      within(drawer).getByRole('textbox', { name: 'Reason for declining' }),
      VALID_REASON,
    );
    await confirmDecline(user, drawer);

    expect(await screen.findByText('BK-1005 declined.')).toBeInTheDocument();
    expectCounts(9, 0, 1, 2);
  });
});

describe('Actions', () => {
  it('AC-01: Approve moves the booking to the Approved tab', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Dana Whitfield');

    await user.click(within(drawer).getByRole('button', { name: /^Approve/ }));

    expect(await screen.findByText('BK-1001 approved.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText('BK-1001')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Approved 2' }));
    expect(renterButton('Dana Whitfield')).toBeInTheDocument();
  });

  it('AC-11: the declined drawer shows the reason the operator typed', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Jordan Alcott');
    await startDecline(user, drawer, `   ${VALID_REASON}   `);
    await confirmDecline(user, drawer);
    await screen.findByText('BK-1007 declined.');

    await user.click(screen.getByRole('tab', { name: 'Declined 2' }));
    const declined = await openBooking(user, 'Jordan Alcott');
    const decided = within(declined).getByRole('region', { name: 'Decided' });
    expect(decided).toHaveTextContent(`Reason: ${VALID_REASON}`);
  });

  it('AC-08: a very long reason is saved and shown in full', async () => {
    const user = await renderLoaded();
    const long = Array.from({ length: 60 }, (_, i) => `Note ${i + 1}: callback unanswered.`).join(
      '\n',
    );
    const drawer = await openBooking(user, 'Jordan Alcott');
    await startDecline(user, drawer, long);
    await confirmDecline(user, drawer);
    await screen.findByText('BK-1007 declined.');

    await user.click(screen.getByRole('tab', { name: 'Declined 2' }));
    const declined = await openBooking(user, 'Jordan Alcott');
    const decided = within(declined).getByRole('region', { name: 'Decided' });
    expect(decided.textContent).toContain(long);
  });

  it('AC-12, AC-13: labels the request being saved, and moves the counts before the API answers', async () => {
    configureApi({ delayMs: 300 });
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Jordan Alcott');

    await user.click(within(drawer).getByRole('button', { name: /^Request verification/ }));

    expect(within(drawer).getByRole('button', { name: 'Requesting…' })).toBeDisabled();
    expect(within(drawer).getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(within(drawer).getByRole('button', { name: 'Decline' })).toBeDisabled();
    expect(within(drawer).getByText('Saving…')).toBeInTheDocument();
    expectCounts(8, 2, 1, 1);

    expect(
      await screen.findByText('Verification requested for BK-1007.', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it('AC-12: a decline in flight says "Declining…" and the counts have already moved', async () => {
    configureApi({ delayMs: 300 });
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Jordan Alcott');
    await startDecline(user, drawer, VALID_REASON);

    await confirmDecline(user, drawer);

    expect(within(drawer).getByRole('button', { name: 'Declining…' })).toBeDisabled();
    expectCounts(8, 1, 1, 2);
    expect(await screen.findByText('BK-1007 declined.', {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

describe('Queue', () => {
  it('Q-15: a row shows "Saving…" while its update is in flight', async () => {
    const user = await renderLoaded();
    // Slow saves only after the queue has loaded.
    configureApi({ delayMs: 1000 });
    const drawer = await openBooking(user, 'Jordan Alcott');
    await user.click(within(drawer).getByRole('button', { name: /^Request verification/ }));
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('tab', { name: 'Verification requested 2' }));
    const row = renterButton('Jordan Alcott').closest('tr')!;
    expect(within(row).getByText('Saving…')).toBeInTheDocument();

    await screen.findByText('Verification requested for BK-1007.', {}, { timeout: 3000 });
    expect(within(row).queryByText('Saving…')).not.toBeInTheDocument();
  });

  it('Q-17: the table is named after its tab', async () => {
    await renderLoaded();
    expect(
      screen.getByRole('table', {
        name: 'Needs review bookings. Select a renter to review the booking.',
      }),
    ).toBeInTheDocument();
  });

  it('Q-18, DR-04: the mobile cards list the same bookings in order and open the drawer', async () => {
    const user = await renderLoaded();
    const cards = within(screen.getByRole('list', { name: 'Needs review bookings' })).getAllByRole(
      'listitem',
    );
    expect(cards.map((card) => card.textContent?.match(/BK-\d{4}/)?.[0])).toEqual([
      'BK-1009',
      'BK-1010',
      'BK-1008',
      'BK-1007',
      'BK-1006',
      'BK-1004',
      'BK-1003',
      'BK-1002',
      'BK-1001',
    ]);

    await user.click(within(cards[3]!).getByRole('button'));

    expect(await screen.findByRole('dialog', { name: 'Jordan Alcott' })).toBeInTheDocument();
  });
});

describe('Drawer behaviour', () => {
  it('DR-13: the header names the booking, car, dates, status and total', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Jordan Alcott');

    expect(within(drawer).getByText('BK-1007')).toBeInTheDocument();
    expect(drawer).toHaveAccessibleDescription(/^2023 Jeep Wrangler · \w{3} \d{1,2} – /);
    expect(within(drawer).getByText('Needs review')).toBeInTheDocument();
    expect(within(drawer).getByText('$550')).toBeInTheDocument();
  });

  it('DR-08: focus moves into the drawer when it opens', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Jordan Alcott');

    await waitFor(() => expect(drawer).toContainElement(document.activeElement as HTMLElement));
  });

  it('DR-09: Tab and Shift+Tab never leave the drawer', async () => {
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Jordan Alcott');

    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(drawer).toContainElement(document.activeElement as HTMLElement);
    }
    for (let i = 0; i < 8; i++) {
      await user.tab({ shift: true });
      expect(drawer).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it('DR-10: a click outside the drawer neither closes it nor loses the reason', async () => {
    // Radix puts pointer-events: none on <body>; this click is the "outside" one.
    const user = await renderLoaded({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const drawer = await openBooking(user, 'Jordan Alcott');
    await startDecline(user, drawer, VALID_REASON);

    await user.click(document.body);

    expect(screen.getByRole('dialog', { name: 'Jordan Alcott' })).toBe(drawer);
    expect(within(drawer).getByRole('textbox', { name: 'Reason for declining' })).toHaveValue(
      VALID_REASON,
    );
  });

  it('DR-07: after a decision moves the booking off the tab, focus goes to the selected tab', async () => {
    const user = await renderLoaded();
    renterButton('Jordan Alcott').focus();
    await user.keyboard('{Enter}');
    const drawer = await screen.findByRole('dialog', { name: 'Jordan Alcott' });

    await user.click(within(drawer).getByRole('button', { name: /^Request verification/ }));

    await screen.findByText('Verification requested for BK-1007.');
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Needs review 8' })).toHaveFocus());
  });

  it('DR-14: each booking opens with fresh local state', async () => {
    const user = await renderLoaded();
    const first = await openBooking(user, 'Jordan Alcott');
    await startDecline(user, first, 'Half-typed reason');
    await user.keyboard('{Escape}');

    const other = await openBooking(user, 'Ryan Kessel');
    expect(within(other).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(other).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const again = await openBooking(user, 'Jordan Alcott');
    expect(within(again).queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('Failures', () => {
  it('FL-04: after a failed decline, unticking the switch and confirming again succeeds', async () => {
    // The demo switch is clicked while the modal sets pointer-events: none on
    // <body>; the CSS that lets it through isn't loaded in jsdom.
    const user = await renderLoaded({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    const failUpdates = screen.getByRole('checkbox', { name: 'Fail status updates' });
    await user.click(failUpdates);
    const drawer = await openBooking(user, 'Jordan Alcott');
    await startDecline(user, drawer, VALID_REASON);
    await confirmDecline(user, drawer);
    await within(drawer).findByRole('alert');
    expectCounts(9, 1, 1, 1);

    await user.click(failUpdates);
    await confirmDecline(user, drawer);

    expect(await screen.findByText('BK-1007 declined.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expectCounts(8, 1, 1, 2);
  });

  it('FL-05: a failed approve explains itself inline and the actions come back', async () => {
    configureApi({ failUpdate: true });
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Dana Whitfield');

    await user.click(within(drawer).getByRole('button', { name: /^Approve/ }));

    expect(await within(drawer).findByRole('alert')).toHaveTextContent(
      'Couldn’t approve BK-1001. Change reverted. Try again.',
    );
    expect(within(drawer).getByRole('button', { name: /^Approve/ })).toBeEnabled();
    expect(within(drawer).getByText('Needs review')).toBeInTheDocument();
    expectCounts(9, 1, 1, 1);
  });

  // BUG (low): after a failed decline the alert says "Your reason is kept".
  // If the operator then presses Cancel and Decline again, the reason box is
  // empty but the same alert is still on screen, now saying something untrue.
  it.fails('FL-10: does not claim the reason is kept once it has been discarded', async () => {
    configureApi({ failUpdate: true });
    const user = await renderLoaded();
    const drawer = await openBooking(user, 'Jordan Alcott');
    await startDecline(user, drawer, VALID_REASON);
    await confirmDecline(user, drawer);
    await within(drawer).findByRole('alert');

    await user.click(within(drawer).getByRole('button', { name: 'Cancel' }));
    await user.click(within(drawer).getByRole('button', { name: /^Decline/ }));

    expect(within(drawer).getByRole('textbox', { name: 'Reason for declining' })).toHaveValue('');
    expect(within(drawer).queryByText(/Your reason is kept/)).not.toBeInTheDocument();
  });
});

describe('Demo controls', () => {
  // BUG (low, demo-only) or spec ambiguity: README says Reload data
  // "refetches what the mock server holds now". After Load empty data the
  // server still holds 12 bookings, but Reload keeps returning none, because
  // Load empty data leaves a hidden switch on that only Reset clears.
  it.fails('DC-07: Reload data after Load empty data brings the bookings back', async () => {
    const user = await renderLoaded();
    const demo = screen.getByRole('complementary', { name: 'Demo controls' });

    await user.click(within(demo).getByRole('button', { name: 'Load empty data' }));
    await screen.findByRole('heading', { name: 'Nothing to review' });
    await user.click(within(demo).getByRole('button', { name: 'Reload data' }));

    expect(await screen.findByRole('tab', { name: 'Needs review 9' })).toBeInTheDocument();
  });

  it('DC-08: Reset demo data recovers from a load error', async () => {
    configureApi({ failLoad: true });
    const user = userEvent.setup();
    render(<RiskReviewPage />);
    await screen.findByRole('alert');
    const demo = screen.getByRole('complementary', { name: 'Demo controls' });

    await user.click(within(demo).getByRole('button', { name: 'Reset demo data' }));

    expect(
      await screen.findByRole('tab', { name: 'Needs review 9' }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(within(demo).getByRole('checkbox', { name: 'Fail loading bookings' })).not.toBeChecked();
  });
});
