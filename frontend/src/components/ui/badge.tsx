import * as React from 'react';
import { cn } from '@/lib/utils/cn';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'neutral'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';
};

function getVariantClasses(variant: NonNullable<BadgeProps['variant']>) {
  switch (variant) {
    case 'secondary':
      return 'border border-border/70 bg-secondary text-secondary-foreground';
    case 'outline':
      return 'border border-border bg-white text-foreground';
    case 'neutral':
      return 'border border-slate-200 bg-slate-50 text-slate-700';
    case 'success':
      return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'warning':
      return 'border border-amber-200 bg-amber-50 text-amber-700';
    case 'danger':
      return 'border border-rose-200 bg-rose-50 text-rose-700';
    case 'info':
      return 'border border-sky-200 bg-sky-50 text-sky-700';
    default:
      return 'border border-primary/15 bg-primary/10 text-primary';
  }
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium tracking-normal',
        getVariantClasses(variant),
        className,
      )}
      {...props}
    />
  );
}
