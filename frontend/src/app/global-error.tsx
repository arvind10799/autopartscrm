'use client';

import { ErrorFallback } from '@/components/feedback/ErrorFallback';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background px-4 py-10 text-foreground">
        <ErrorFallback
          title="The application shell failed to load"
          description="A critical rendering error prevented the workspace from starting."
          onReset={reset}
        />
      </body>
    </html>
  );
}
