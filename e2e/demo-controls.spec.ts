import { expect, test } from '@playwright/test';
import { demoControls, expectCounts, openBooking, openQueue } from './helpers';

/** TEST_CASES.md DC-06, Q-02. */

test('Reset demo data restores 9/1/1/1 and the default switches', async ({ page }) => {
  await openQueue(page);
  await expectCounts(page, 9, 1, 1, 1);

  const approve = await openBooking(page, 'Dana Whitfield');
  await approve.getByRole('button', { name: /^Approve/ }).click();
  await expect(approve).toBeHidden();
  await expectCounts(page, 8, 1, 2, 1);

  const demo = demoControls(page);
  await demo.getByRole('checkbox', { name: 'Fail status updates' }).check();
  await demo.getByRole('combobox', { name: 'API delay' }).selectOption('0');

  await demo.getByRole('button', { name: 'Reset demo data' }).click();

  await expectCounts(page, 9, 1, 1, 1);
  await expect(demo.getByRole('checkbox', { name: 'Fail status updates' })).not.toBeChecked();
  await expect(demo.getByRole('checkbox', { name: 'Fail loading bookings' })).not.toBeChecked();
  await expect(demo.getByRole('combobox', { name: 'API delay' })).toHaveValue('600');
});

test('Reload data keeps decisions; Reset demo data discards them', async ({ page }) => {
  await openQueue(page);
  const dialog = await openBooking(page, 'Dana Whitfield');
  await dialog.getByRole('button', { name: /^Approve/ }).click();
  await expect(dialog).toBeHidden();

  const demo = demoControls(page);
  await demo.getByRole('button', { name: 'Reload data' }).click();
  await expectCounts(page, 8, 1, 2, 1);

  await demo.getByRole('button', { name: 'Reset demo data' }).click();
  await expectCounts(page, 9, 1, 1, 1);
});
