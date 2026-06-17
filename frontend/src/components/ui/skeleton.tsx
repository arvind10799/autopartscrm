import { cn } from '@/lib/utils/cn';

export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-xl bg-gradient-to-r from-muted via-white/70 to-muted',
        className,
      )}
    />
  );
}
