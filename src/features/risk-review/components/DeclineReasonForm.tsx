import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { DECLINE_REASON_MIN_LENGTH } from '../lib/risk.config';

type DeclineReasonFormProps = {
  isPending: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
};

/**
 * Decline always needs a reason (CLAUDE.md). The count is of trimmed text,
 * the same rule the hook and the API apply, so spaces can't pad a reason out.
 */
export function DeclineReasonForm({ isPending, onSubmit, onCancel }: DeclineReasonFormProps) {
  const id = useId();
  const [reason, setReason] = useState('');
  // The error waits for the first submit, so nobody is told off while still typing.
  const [showError, setShowError] = useState(false);

  const length = reason.trim().length;
  const isTooShort = length < DECLINE_REASON_MIN_LENGTH;
  const hasError = showError && isTooShort;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isTooShort) {
      setShowError(true);
      return;
    }
    onSubmit(reason.trim());
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-2 rounded-md border border-red-200 bg-red-50/50 p-3"
    >
      <label htmlFor={`${id}-reason`} className="block text-sm font-medium text-slate-900">
        Reason for declining
      </label>
      <textarea
        id={`${id}-reason`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        // Moving focus here when the form opens is what the operator asked for
        // by pressing Decline, so the jsx-a11y warning doesn't apply.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        aria-invalid={hasError}
        aria-describedby={`${id}-count${hasError ? ` ${id}-error` : ''}`}
        className={cn(
          'block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900',
          hasError ? 'border-red-600' : 'border-slate-300',
        )}
      />
      <p id={`${id}-count`} className="text-xs text-slate-600 tabular-nums">
        {length} / {DECLINE_REASON_MIN_LENGTH} characters minimum
      </p>
      {hasError && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-red-700">
          Enter at least {DECLINE_REASON_MIN_LENGTH} characters so the reason is clear later.
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" variant="danger" disabled={isPending}>
          {isPending ? 'Declining…' : 'Confirm decline'}
        </Button>
        <Button onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
