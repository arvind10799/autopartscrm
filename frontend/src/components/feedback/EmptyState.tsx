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
        'mx-auto flex max-w-md flex-col items-center rounded-[1.5rem] border border-dashed border-sky-200/90 bg-[radial-gradient(circle_at_top,#eff8ff_0%,#ffffff_52%,#f8fafc_100%)] px-6 py-10 text-center shadow-sm shadow-sky-950/5 ring-1 ring-white/80',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-100 bg-white text-primary shadow-sm shadow-sky-950/10 ring-4 ring-sky-50">
          {icon}
        </div>
      ) : null}
      <h3 className="font-[var(--font-heading)] text-lg font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
