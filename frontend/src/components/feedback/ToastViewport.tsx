'use client';

import { useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { useToastStore, type ToastRecord } from '@/lib/stores/toast.store';
import { cn } from '@/lib/utils/cn';

const variantStyles: Record<
  ToastRecord['variant'],
  { card: string; icon: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    card: 'border-emerald-200 bg-emerald-50/95 text-emerald-950',
    icon: 'text-emerald-600',
    Icon: CheckCircle2,
  },
  error: {
    card: 'border-destructive/25 bg-white/95 text-foreground',
    icon: 'text-destructive',
    Icon: AlertCircle,
  },
  info: {
    card: 'border-border/80 bg-white/95 text-foreground',
    icon: 'text-primary',
    Icon: Info,
  },
  warning: {
    card: 'border-amber-200 bg-amber-50/95 text-amber-950',
    icon: 'text-amber-600',
    Icon: AlertTriangle,
  },
};

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end"
    >
      <div className="flex w-full max-w-md flex-col gap-3">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onDismiss, toast.durationMs, toast.id]);

  const { Icon, card, icon } = variantStyles[toast.variant];

  return (
    <section
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto rounded-2xl border px-4 py-4 shadow-lg backdrop-blur transition',
        card,
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex-shrink-0', icon)}>
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold">{toast.title}</p>
          {toast.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {toast.description}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Dismiss notification"
          className="rounded-full p-1 text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
          onClick={() => onDismiss(toast.id)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
