import { Button } from './Button';

type ErrorStateProps = {
  title: string;
  message: string;
  onRetry: () => void;
};

/** `role="alert"` makes screen readers announce it as soon as it appears. */
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-red-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-red-800">{message}</p>
      <Button variant="primary" className="mt-4" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
