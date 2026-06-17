import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border/80 bg-secondary/40 px-6 py-10 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
          {icon}
        </div>
      ) : null}
      <h3 className="font-[var(--font-heading)] text-lg font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
