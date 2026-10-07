import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Ink text, not white: white on the brand orange is only 2.65:1.
  primary: 'border-transparent bg-primary text-ink hover:bg-primary-hover',
  secondary: 'border-line-strong bg-white text-ink hover:bg-surface-alt',
  danger: 'border-transparent bg-red-700 text-white hover:bg-red-800',
};

/**
 * Every prop a native <button> accepts, plus `variant`.
 * `ComponentPropsWithoutRef<'button'>` is React's type for those native props.
 */
type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = 'secondary',
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      // Defaults to "button" so it never submits a surrounding form by accident.
      type={type}
      className={cn(
        'inline-flex min-h-9 items-center justify-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...rest}
    />
  );
}
