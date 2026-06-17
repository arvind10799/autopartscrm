import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
};

export function buttonVariants({
  variant = 'default',
  size = 'default',
  className,
}: {
  variant?: NonNullable<ButtonProps['variant']>;
  size?: NonNullable<ButtonProps['size']>;
  className?: string;
}) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    getVariantClasses(variant),
    getSizeClasses(size),
    className,
  );
}

function getVariantClasses(variant: NonNullable<ButtonProps['variant']>) {
  switch (variant) {
    case 'outline':
      return 'border border-border bg-white text-foreground shadow-sm hover:bg-secondary';
    case 'ghost':
      return 'bg-transparent text-foreground hover:bg-secondary';
    default:
      return 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/92';
  }
}

function getSizeClasses(size: NonNullable<ButtonProps['size']>) {
  switch (size) {
    case 'sm':
      return 'h-9 rounded-lg px-3.5 text-sm';
    case 'lg':
      return 'h-11 rounded-xl px-5 text-sm';
    default:
      return 'h-10 rounded-lg px-4 text-sm';
  }
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={props.type ?? 'button'}
        className={buttonVariants({ variant, size, className })}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
