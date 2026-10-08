import { expect, test } from '@playwright/test';
import {
  VALID_REASON,
  demoControls,
  expectCounts,
  openBooking,
  openQueue,
  reasonBox,
  tab,
} from './helpers';

/** TEST_CASES.md FL-03, FL-04, FL-11, Q-13, DC-01, DC-02. */

test.beforeEach(async ({ page }) => {
  await openQueue(page);
});

test('failed decline keeps the drawer, the reason and an inline error; retry succeeds', async ({
  page,
}) => {
  const failUpdates = demoControls(page).getByRole('checkbox', { name: 'Fail status updates' });
  await failUpdates.check();

  const dialog = await openBooking(page, 'Jordan Alcott');
  await dialog.getByRole('button', { name: 'Decline' }).click();
  await reasonBox(dialog).fill(VALID_REASON);
  await dialog.getByRole('button', { name: 'Confirm decline' }).click();

  await expect(dialog.getByRole('alert')).toHaveText(
    'Couldn’t decline BK-1007. Your reason is kept; try again.',
  );
  await expect(dialog).toBeVisible();
  await expect(reasonBox(dialog)).toHaveValue(VALID_REASON);
  await expect(dialog.getByRole('button', { name: 'Confirm decline' })).toBeEnabled();
  await expectCounts(page, 9, 1, 1, 1);

  // The demo controls sit above the drawer's overlay, so this doesn't close it.
  await failUpdates.uncheck();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm decline' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('BK-1007 declined.')).toBeVisible();
  await expectCounts(page, 8, 1, 1, 2);
});

test('focus stays inside the drawer after a failed save (keyboard user)', async ({ page }) => {
  await demoControls(page).getByRole('checkbox', { name: 'Fail status updates' }).check();
  const dialog = await openBooking(page, 'Jordan Alcott');
  await dialog.getByRole('button', { name: 'Decline' }).click();
  await reasonBox(dialog).fill(VALID_REASON);

  const confirm = dialog.getByRole('button', { name: 'Confirm decline' });
  await confirm.focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('alert')).toBeVisible();

  const focusInside = await dialog.evaluate((el) => el.contains(document.activeElement));
  expect(focusInside).toBe(true);
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
});

test('a load failure shows an error, and Retry recovers', async ({ page }) => {
  const demo = demoControls(page);
  const failLoad = demo.getByRole('checkbox', { name: 'Fail loading bookings' });
  await failLoad.check();
  await demo.getByRole('button', { name: 'Reload data' }).click();

  const alert = page.getByRole('alert');
  await expect(alert.getByRole('heading', { name: 'Couldn’t load bookings' })).toBeVisible();
  await expect(page.getByRole('tablist')).toBeHidden();

  await failLoad.uncheck();
  await alert.getByRole('button', { name: 'Retry' }).click();

  await expect(page.getByRole('alert')).toBeHidden();
  await expect(tab(page, 'Needs review 9')).toBeFocused();
  await expectCounts(page, 9, 1, 1, 1);
});
