import { expect, test } from '@playwright/test';
import { VALID_REASON, expectCounts, openBooking, openQueue, reasonBox, tab } from './helpers';

/** TEST_CASES.md AC-04, AC-06, AC-11, Q-10, RC-01. */

test.beforeEach(async ({ page }) => {
  await openQueue(page);
});

test('happy path: decline BK-1007 with a valid reason moves it to Declined (8/2)', async ({
  page,
}) => {
  await expectCounts(page, 9, 1, 1, 1);
  const dialog = await openBooking(page, 'Jordan Alcott');
  await expect(dialog.getByText('BK-1007')).toBeVisible();

  await dialog.getByRole('button', { name: 'Decline' }).click();
  await reasonBox(dialog).fill(VALID_REASON);
  await dialog.getByRole('button', { name: 'Confirm decline' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('BK-1007 declined.')).toBeVisible();
  await expectCounts(page, 8, 1, 1, 2);

  await tab(page, 'Declined 2').click();
  const declined = await openBooking(page, 'Jordan Alcott');
  await expect(declined.getByRole('region', { name: 'Decided' })).toContainText(
    `Reason: ${VALID_REASON}`,
  );
});

test('a reason under 10 characters is blocked', async ({ page }) => {
  const dialog = await openBooking(page, 'Jordan Alcott');
  await dialog.getByRole('button', { name: 'Decline' }).click();

  await reasonBox(dialog).fill('Too short');
  await expect(dialog.getByText('9 / 10 characters minimum')).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm decline' }).click();

  await expect(dialog.getByRole('alert')).toContainText('Enter at least 10 characters');
  await expect(reasonBox(dialog)).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog).toBeVisible();
  await expectCounts(page, 9, 1, 1, 1);
});

test('a whitespace-only reason is blocked', async ({ page }) => {
  const dialog = await openBooking(page, 'Jordan Alcott');
  await dialog.getByRole('button', { name: 'Decline' }).click();

  await reasonBox(dialog).fill(' '.repeat(20));
  await expect(dialog.getByText('0 / 10 characters minimum')).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm decline' }).click();

  await expect(dialog.getByRole('alert')).toContainText('Enter at least 10 characters');
  await expect(dialog).toBeVisible();
  await expectCounts(page, 9, 1, 1, 1);
});

test('ID pending (BK-1009): Approve is disabled with a visible reason', async ({ page }) => {
  const dialog = await openBooking(page, 'Noor Haddad');

  const approve = dialog.getByRole('button', { name: 'Approve' });
  await expect(approve).toBeDisabled();
  await expect(
    dialog.getByText('Approve is unavailable until the ID check returns.'),
  ).toBeVisible();
  await expect(approve).toHaveAccessibleDescription(
    'Approve is unavailable until the ID check returns.',
  );
  await expect(dialog.getByRole('button', { name: 'Request verification' })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Decline' })).toBeEnabled();
  await expect(dialog.getByText('Risk score pending ID check')).toBeVisible();
});
