import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  boxOf,
  demoControls,
  hasNoHorizontalScroll,
  openBooking,
  openQueue,
  overlaps,
  reasonBox,
  tab,
} from './helpers';

/** TEST_CASES.md RW-01 to RW-08. Real CSS, so these can only run in a browser. */

const WIDTHS = [
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 800, height: 900 },
  { width: 1280, height: 800 },
];

async function expectDockClearOf(page: Page, targets: Locator[]) {
  const dock = await boxOf(demoControls(page));
  for (const target of targets) {
    const box = await boxOf(target);
    expect(
      overlaps(dock, box),
      `Demo controls ${JSON.stringify(dock)} overlap ${JSON.stringify(box)}`,
    ).toBe(false);
  }
}

for (const viewport of WIDTHS) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });

    test('no horizontal scroll, queue or open drawer', async ({ page }) => {
      await openQueue(page);
      expect(await hasNoHorizontalScroll(page)).toBe(true);

      await openBooking(page, 'Jordan Alcott');
      expect(await hasNoHorizontalScroll(page)).toBe(true);
    });

    test('the Demo controls never cover the drawer’s action buttons', async ({ page }) => {
      await openQueue(page);
      const dialog = await openBooking(page, 'Jordan Alcott');

      await expectDockClearOf(page, [
        dialog.getByRole('button', { name: 'Decline' }),
        dialog.getByRole('button', { name: /^Approve/ }),
        dialog.getByRole('button', { name: /^Request verification/ }),
      ]);

      await dialog.getByRole('button', { name: 'Decline' }).click();
      await expectDockClearOf(page, [
        dialog.getByRole('button', { name: 'Confirm decline' }),
        dialog.getByRole('button', { name: 'Cancel' }),
        reasonBox(dialog),
      ]);
    });
  });
}

test.describe('360px layout', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('shows cards, not the table', async ({ page }) => {
    await openQueue(page);
    await expect(page.getByRole('list', { name: 'Needs review bookings' })).toBeVisible();
    await expect(page.getByRole('table')).toBeHidden();
  });

  // BUG (low): the "Reason:" line in a declined booking's drawer doesn't wrap
  // long words. A 200-character unbroken reason (a pasted URL or reference
  // number) runs off the right edge and the drawer body scrolls sideways
  // (1543px of content in a 345px box at 360px wide).
  test('a long unbroken decline reason wraps inside the drawer', async ({ page }) => {
    test.fail();
    await openQueue(page);
    const word = 'x'.repeat(200);
    const dialog = await openBooking(page, 'Jordan Alcott');
    await dialog.getByRole('button', { name: 'Decline' }).click();
    await reasonBox(dialog).fill(word);
    await dialog.getByRole('button', { name: 'Confirm decline' }).click();
    await expect(dialog).toBeHidden();

    await tab(page, 'Declined 2').click();
    const declined = await openBooking(page, 'Jordan Alcott');
    const reason = declined.getByText(word);
    await expect(reason).toBeVisible();

    const fits = await reason.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits, 'the reason overflows its box sideways').toBe(true);
    const drawer = await boxOf(declined);
    const text = await boxOf(reason);
    expect(text.x + text.width).toBeLessThanOrEqual(drawer.x + drawer.width);
  });
});

test.describe('768px layout', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('the table fits its card without clipping', async ({ page }) => {
    await openQueue(page);
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    const clipped = await table.evaluate((el) => {
      const card = el.parentElement;
      return card ? el.scrollWidth > card.clientWidth : false;
    });
    expect(clipped, 'the table is wider than its card and gets cut off').toBe(false);
  });
});

test.describe('dock placement beside the drawer', () => {
  test('800px: the dock collapses and stays clear of the drawer', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await openQueue(page);
    const failLoad = demoControls(page).getByRole('checkbox', { name: 'Fail loading bookings' });
    await expect(failLoad).toBeVisible();

    const dialog = await openBooking(page, 'Jordan Alcott');

    await expect(failLoad).toBeHidden();
    expect(overlaps(await boxOf(demoControls(page)), await boxOf(dialog))).toBe(false);
  });

  test('1280px: the dock stays open beside the drawer without overlapping it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openQueue(page);

    const dialog = await openBooking(page, 'Jordan Alcott');

    await expect(
      demoControls(page).getByRole('checkbox', { name: 'Fail loading bookings' }),
    ).toBeVisible();
    expect(overlaps(await boxOf(demoControls(page)), await boxOf(dialog))).toBe(false);
  });
});
