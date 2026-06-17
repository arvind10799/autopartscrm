'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { toast } from '@/lib/stores/toast.store';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Route error boundary', error);
    toast.error(
      'Unexpected page error',
      'This page hit an unexpected problem. Try again or reload if it persists.',
    );
  }, [error]);

  return (
    <ErrorFallback
      title="This page could not be rendered"
      description="An unexpected application error interrupted the current route."
      onReset={reset}
    />
  );
}
