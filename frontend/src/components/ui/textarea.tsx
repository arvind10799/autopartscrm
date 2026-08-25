import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[110px] w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';
