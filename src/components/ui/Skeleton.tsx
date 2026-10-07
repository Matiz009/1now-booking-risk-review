import { cn } from '@/lib/cn';

type SkeletonProps = {
  className?: string;
};

/** A grey placeholder bar. Hidden from screen readers; the caller announces "Loading". */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('bg-line animate-pulse rounded', className)} />;
}
