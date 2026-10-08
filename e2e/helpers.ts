import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared steps for the E2E specs. Every locator is by role, label or text.
 * Each test loads the page fresh, and the mock API keeps its data in memory,
 * so every test starts from the original 12 bookings (9/1/1/1).
 */

export const VALID_REASON = 'Renter could not confirm identity by phone.';

export async function openQueue(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('tablist', { name: 'Booking status' })).toBeVisible();
}

/**
 * A status tab by its full accessible name, e.g. "Needs review 9". Includes
 * elements hidden from assistive tech, because the open drawer is modal and
 * hides the page behind it.
 */
export function tab(page: Page, name: string): Locator {
  return page.getByRole('tab', { name, exact: true, includeHidden: true });
}

export async function expectCounts(
  page: Page,
  review: number,
  verification: number,
  approved: number,
  declined: number,
) {
  await expect(tab(page, `Needs review ${review}`)).toBeAttached();
  await expect(tab(page, `Verification requested ${verification}`)).toBeAttached();
  await expect(tab(page, `Approved ${approved}`)).toBeAttached();
  await expect(tab(page, `Declined ${declined}`)).toBeAttached();
}

/** The control that opens a booking: the renter button on desktop, the card below md. */
export function bookingTrigger(page: Page, renter: string): Locator {
  return page
    .getByRole('table')
    .getByRole('button', { name: renter })
    .or(
      page
        .getByRole('list', { name: /bookings$/ })
        .getByRole('button', { name: new RegExp(renter) }),
    );
}

export async function openBooking(page: Page, renter: string): Promise<Locator> {
  await bookingTrigger(page, renter).click();
  const dialog = page.getByRole('dialog', { name: renter });
  await expect(dialog).toBeVisible();
  return dialog;
}

export function demoControls(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Demo controls' });
}

export function reasonBox(dialog: Locator): Locator {
  return dialog.getByRole('textbox', { name: 'Reason for declining' });
}

/** True when the page itself can't scroll sideways. */
export function hasNoHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

type Box = { x: number; y: number; width: number; height: number };

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Element has no bounding box (not visible)');
  }
  return box;
}
