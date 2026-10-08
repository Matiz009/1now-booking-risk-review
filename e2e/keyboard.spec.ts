import { expect, test, type Locator, type Page } from '@playwright/test';
import { VALID_REASON, expectCounts, openQueue, tab } from './helpers';

/** TEST_CASES.md A11Y-03 to A11Y-06, DR-03, DR-05, DR-12. Keyboard only, no mouse. */

test.beforeEach(async ({ page }) => {
  await openQueue(page);
});

async function isFocused(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => el === document.activeElement);
}

/** Presses Tab until `target` has focus, failing after `max` presses. */
async function tabTo(page: Page, target: Locator, max = 20) {
  for (let i = 0; i < max; i++) {
    if (await isFocused(target)) {
      return;
    }
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

/** The browser's computed focus outline, read the way a sighted keyboard user would see it. */
function outlineOf(locator: Locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
}

test('Tab to a renter, Enter opens, Esc closes, focus returns to that renter', async ({ page }) => {
  const renter = page.getByRole('table').getByRole('button', { name: 'Noor Haddad' });

  await tabTo(page, renter);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Noor Haddad' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(renter).toBeFocused();
});

test('a whole decline can be done with the keyboard alone', async ({ page }) => {
  const renter = page.getByRole('table').getByRole('button', { name: 'Jordan Alcott' });
  await tabTo(page, renter);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Jordan Alcott' });
  await expect(dialog).toBeVisible();

  await tabTo(page, dialog.getByRole('button', { name: 'Decline' }));
  await page.keyboard.press('Enter');
  const reason = dialog.getByRole('textbox', { name: 'Reason for declining' });
  await expect(reason).toBeFocused();
  await page.keyboard.type(VALID_REASON);
  await tabTo(page, dialog.getByRole('button', { name: 'Confirm decline' }));
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  await expectCounts(page, 8, 1, 1, 2);
  // The booking left the tab, so focus goes to the selected tab, not <body>.
  await expect(tab(page, 'Needs review 8')).toBeFocused();
});

test('keyboard focus is visible on tabs, renter buttons and drawer buttons', async ({ page }) => {
  const statusTab = tab(page, 'Needs review 9');
  await tabTo(page, statusTab);
  expect((await outlineOf(statusTab)).style).not.toBe('none');
  expect((await outlineOf(statusTab)).width).toBeGreaterThan(0);

  const renter = page.getByRole('table').getByRole('button', { name: 'Noor Haddad' });
  await tabTo(page, renter);
  expect((await outlineOf(renter)).style).not.toBe('none');
  expect((await outlineOf(renter)).width).toBeGreaterThan(0);

  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Noor Haddad' });
  const decline = dialog.getByRole('button', { name: 'Decline' });
  await tabTo(page, decline);
  expect((await outlineOf(decline)).style).not.toBe('none');
  expect((await outlineOf(decline)).width).toBeGreaterThan(0);
});
