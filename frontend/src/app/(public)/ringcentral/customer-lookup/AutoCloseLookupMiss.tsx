'use client';

import { useEffect } from 'react';

type AutoCloseLookupMissProps = {
  delayMs?: number;
};

export function AutoCloseLookupMiss({
  delayMs = 1000,
}: AutoCloseLookupMissProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      window.close();
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [delayMs]);

  return (
    <main
      aria-label="No existing customer found"
      className="min-h-screen bg-slate-950"
    />
  );
}
