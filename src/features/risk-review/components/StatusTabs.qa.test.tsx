import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { BookingStatus } from '../types';
import { StatusTabs } from './StatusTabs';

/** QA additions (TEST_CASES.md Q-08, Q-09, A11Y-09): the ARIA tabs pattern. */

const counts: Record<BookingStatus, number> = {
  needs_review: 9,
  verification_requested: 1,
  approved: 1,
  declined: 1,
};

/** The tabs with real selection state, as the page uses them. */
function Harness() {
  const [active, setActive] = useState<BookingStatus>('needs_review');
  return (
    <>
      <StatusTabs active={active} counts={counts} onChange={setActive} panelId="panel" />
      <div role="tabpanel" id="panel" />
    </>
  );
}

function tab(name: RegExp) {
  return screen.getByRole('tab', { name });
}

function expectSelected(name: RegExp) {
  expect(tab(name)).toHaveFocus();
  expect(tab(name)).toHaveAttribute('aria-selected', 'true');
  expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
}

describe('Status tabs keyboard', () => {
  it('Q-08: ArrowLeft from the first tab wraps to the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    tab(/needs review/i).focus();
    await user.keyboard('{ArrowLeft}');

    expectSelected(/declined/i);
  });

  it('Q-08: ArrowRight from the last tab wraps to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    tab(/needs review/i).focus();
    await user.keyboard('{End}{ArrowRight}');

    expectSelected(/needs review/i);
  });

  it('Q-08: End and Home jump to the ends', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    tab(/needs review/i).focus();
    await user.keyboard('{End}');
    expectSelected(/declined/i);

    await user.keyboard('{Home}');
    expectSelected(/needs review/i);
  });

  it('Q-08: other keys do nothing', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    tab(/needs review/i).focus();
    await user.keyboard('{ArrowDown}a');

    expectSelected(/needs review/i);
  });

  it('Q-09: only the selected tab is in the Tab order', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Harness />
        <button type="button">After</button>
      </>,
    );

    screen.getByRole('button', { name: 'Before' }).focus();
    await user.tab();
    expect(tab(/needs review/i)).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();

    for (const other of [/verification/i, /approved/i, /declined/i]) {
      expect(tab(other)).toHaveAttribute('tabindex', '-1');
    }
  });

  it('A11Y-09: names the tablist and links every tab to the panel', () => {
    render(<Harness />);

    expect(screen.getByRole('tablist', { name: 'Booking status' })).toBeInTheDocument();
    for (const t of screen.getAllByRole('tab')) {
      expect(t).toHaveAttribute('aria-controls', 'panel');
    }
    expect(tab(/needs review/i)).toHaveAccessibleName('Needs review 9');
  });
});
