import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeclineReasonForm } from './DeclineReasonForm';

/**
 * QA additions (TEST_CASES.md AC-05 to AC-10): the decline-reason rule,
 * "min 10 characters", at its edges. The form is rendered on its own so each
 * case can check exactly what would be submitted.
 */

function renderForm() {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(<DeclineReasonForm isPending={false} onSubmit={onSubmit} onCancel={onCancel} />);
  const reason = screen.getByRole('textbox', { name: 'Reason for declining' });
  const confirm = () => user.click(screen.getByRole('button', { name: 'Confirm decline' }));
  return { user, reason, confirm, onSubmit, onCancel };
}

describe('Decline reason', () => {
  it('AC-03: focuses the labelled reason box when it opens', () => {
    const { reason } = renderForm();
    expect(reason).toHaveFocus();
  });

  it('AC-05: accepts exactly 10 characters', async () => {
    const { user, reason, confirm, onSubmit } = renderForm();

    await user.type(reason, '1234567890');
    expect(screen.getByText('10 / 10 characters minimum')).toBeInTheDocument();
    await confirm();

    expect(onSubmit).toHaveBeenCalledWith('1234567890');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('AC-04: blocks 9 characters', async () => {
    const { user, reason, confirm, onSubmit } = renderForm();

    await user.type(reason, '123456789');
    await confirm();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter at least 10 characters');
  });

  it('AC-06: blocks a whitespace-only reason and counts it as 0', async () => {
    const { user, reason, confirm, onSubmit } = renderForm();

    await user.type(reason, ' '.repeat(15));
    expect(screen.getByText('0 / 10 characters minimum')).toBeInTheDocument();
    await confirm();

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(reason).toHaveAttribute('aria-invalid', 'true');
  });

  it('AC-06: blocks line breaks and tabs only', async () => {
    const { user, reason, confirm, onSubmit } = renderForm();

    await user.click(reason);
    await user.paste('\n\n\t\t\t\n\n\t\t\t\n');
    await confirm();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('AC-07: does not count padding toward the minimum', async () => {
    const { user, reason, confirm, onSubmit } = renderForm();

    await user.type(reason, '   short    ');
    expect(screen.getByText('5 / 10 characters minimum')).toBeInTheDocument();
    await confirm();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('AC-07: submits a padded 10-character reason trimmed', async () => {
    const { user, reason, confirm, onSubmit } = renderForm();

    await user.type(reason, '  1234567890  ');
    await confirm();

    expect(onSubmit).toHaveBeenCalledWith('1234567890');
  });

  it('AC-08: accepts a very long reason with line breaks and submits it whole', async () => {
    const { user, reason, confirm, onSubmit } = renderForm();
    const long = Array.from(
      { length: 80 },
      (_, i) => `Line ${i + 1}: renter did not respond.`,
    ).join('\n');

    await user.click(reason);
    await user.paste(`  ${long}  `);
    await confirm();

    expect(long.length).toBeGreaterThan(2000);
    expect(onSubmit).toHaveBeenCalledWith(long);
  });

  // BUG (low): the rule is "at least 10 characters", but the count is UTF-16
  // code units. Five car emoji are 5 characters to the operator, yet count as
  // 10 and pass. The same rule is used by the hook and the mock API.
  it.fails('counts characters as people see them, not UTF-16 units', async () => {
    const { user, reason, confirm, onSubmit } = renderForm();

    await user.click(reason);
    await user.paste('🚗🚗🚗🚗🚗');
    await confirm();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('AC-09: shows no error while typing, then only after a submit, and clears it once fixed', async () => {
    const { user, reason, confirm } = renderForm();

    await user.type(reason, 'abc');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(reason).toHaveAttribute('aria-invalid', 'false');

    await confirm();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(reason).toHaveAccessibleDescription(/Enter at least 10 characters/);

    await user.type(reason, 'defghij');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(reason).toHaveAttribute('aria-invalid', 'false');
  });

  it('AC-10: Cancel calls onCancel and submits nothing', async () => {
    const { user, reason, onSubmit, onCancel } = renderForm();

    await user.type(reason, 'A perfectly valid reason');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('AC-12: says "Declining…" and disables both buttons while pending', () => {
    render(<DeclineReasonForm isPending onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Declining…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
