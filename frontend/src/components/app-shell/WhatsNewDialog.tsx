'use client';

import { useEffect, useRef } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserRole } from '@/features/auth/types/auth.types';
import {
  CURRENT_RELEASE,
  getReleaseHighlights,
  hasReleaseHighlights,
} from '@/lib/config/current-release';

export function WhatsNewDialog({
  open,
  role,
  onDismiss,
  onOpenWebsiteLeads,
}: {
  open: boolean;
  role: UserRole;
  onDismiss: () => void;
  onOpenWebsiteLeads: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const highlights = getReleaseHighlights(role);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="whats-new-title"
      aria-describedby="whats-new-description"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/60 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:w-full"
    >
      <div className="border-b border-orange-100 bg-gradient-to-br from-orange-50 via-white to-sky-50 px-5 pb-5 pt-5 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 sm:px-7 sm:pt-6">
        <div className="flex items-start justify-between gap-4">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close What’s New"
            className="rounded-lg p-2 text-slate-500 hover:bg-white/80 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">
          Version {CURRENT_RELEASE.version} · {CURRENT_RELEASE.date}
        </p>
        <h2 id="whats-new-title" className="mt-1 font-[var(--font-heading)] text-2xl font-semibold tracking-tight sm:text-3xl">
          {CURRENT_RELEASE.title}
        </h2>
        <p id="whats-new-description" className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {hasReleaseHighlights(role)
            ? 'A simpler way to manage requests from your website.'
            : 'This release focuses on the Website Leads sales workspace.'}
        </p>
      </div>

      {highlights.length > 0 ? (
        <div className="max-h-[min(48dvh,22rem)] space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
          {highlights.map((highlight, index) => (
            <div key={highlight.title} className="flex gap-3.5">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold">{highlight.title}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{highlight.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-7">
        <Button variant="outline" onClick={onDismiss}>Got it</Button>
        {hasReleaseHighlights(role) ? (
          <Button onClick={onOpenWebsiteLeads}>
            Open Website Leads <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </dialog>
  );
}
