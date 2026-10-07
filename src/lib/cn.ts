/**
 * Joins class names, skipping falsy ones, so conditional classes read as
 * `cn('base', isActive && 'active')`. Six lines instead of the clsx package.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
