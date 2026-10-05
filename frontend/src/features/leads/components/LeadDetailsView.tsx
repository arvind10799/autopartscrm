'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  MessageSquarePlus,
} from 'lucide-react';
import { DetailPageSkeleton } from '@/components/feedback/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { notesApi } from '@/features/notes/api/notes-api';
import type { NoteRecord } from '@/features/notes/types/note.types';
import { formatNoteTimestamp } from '@/features/notes/lib/notes.helpers';
import { toast } from '@/lib/stores/toast.store';
import { cn } from '@/lib/utils/cn';
import { leadsApi } from '../api/leads-api';
import { formatDate, formatLeadCurrency } from '../lib/lead-formatters';
import { formatLeadStatusLabel } from '../lib/leads.helpers';
import type { LeadSummary } from '../types/lead.types';

export function LeadDetailsView({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<LeadSummary | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadLead() {
      setIsLoading(true);
      setError(null);

      try {
        const loadedLead = await leadsApi.getById(leadId);

        if (isMounted) {
          setLead(loadedLead);
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load lead details.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLead();

    return () => {
      isMounted = false;
    };
  }, [leadId, refreshKey]);

  useEffect(() => {
    let isMounted = true;

    async function loadNotes() {
      setIsLoadingNotes(true);
      setNotesError(null);

      try {
        const loadedNotes = await notesApi.listByEntity('LEAD', leadId);

        if (isMounted) {
          setNotes(loadedNotes);
        }
      } catch (caughtError) {
        if (isMounted) {
          setNotesError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load lead comments.',
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingNotes(false);
        }
      }
    }

    void loadNotes();

    return () => {
      isMounted = false;
    };
  }, [leadId, refreshKey]);

  const sortedNotes = useMemo(
    () =>
      [...notes].sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      ),
    [notes],
  );

  const handleAddComment = async () => {
    const trimmedMessage = noteMessage.trim();

    if (!trimmedMessage) {
      setNoteError('Comment is required.');
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);

    try {
      await notesApi.create({
        entityType: 'LEAD',
        entityId: leadId,
        message: trimmedMessage,
      });
      setNoteMessage('');
      setRefreshKey((currentValue) => currentValue + 1);
      toast.success('Comment added', 'Lead comments have been refreshed.');
    } catch (caughtError) {
      setNoteError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to add this comment right now.',
      );
    } finally {
      setIsSavingNote(false);
    }
  };

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !lead) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Lead details</CardTitle>
          <CardDescription>The requested lead could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {error ?? 'Lead details are unavailable.'}
          </div>
          <Link
            href="/leads"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to leads
          </Link>
        </CardContent>
      </Card>
    );
  }

  const status = lead.isConverted ? 'CONVERTED' : lead.status;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to leads
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {lead.customerName}
            </h1>
            <LeadStatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {lead.customerPhone} · Created by {lead.createdBy.name}
          </p>
        </div>

        {lead.isConverted && lead.convertedOrder ? (
          <Link
            href={`/orders/${lead.convertedOrder.id}`}
            className={cn(
              buttonVariants({ variant: 'default', size: 'sm' }),
              'rounded-xl bg-[#ff5a00] text-white hover:bg-[#e65000]',
            )}
          >
            View order
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <div className="space-y-4">
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Lead details</CardTitle>
              <CardDescription>
                Customer, vehicle, quote, and sales intake information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailSection title="Customer">
                <DetailItem label="Name" value={lead.customerName} />
                <DetailItem label="Phone" value={lead.customerPhone} />
                <DetailItem label="Email" value={formatNullableText(lead.customerEmail)} />
                <DetailItem label="State" value={formatNullableText(lead.state)} />
              </DetailSection>

              <DetailSection title="Vehicle / part">
                <DetailItem label="Year" value={formatNullableText(lead.vehicleYear)} />
                <DetailItem label="Make" value={formatNullableText(lead.vehicleMake)} />
                <DetailItem label="Model" value={formatNullableText(lead.vehicleModel)} />
                <DetailItem label="Part" value={formatNullableText(lead.vehicleVariant)} />
                <DetailItem label="Description" value={lead.partDescription} wide />
              </DetailSection>

              <DetailSection title="Sales">
                <DetailItem label="Lead date" value={formatDate(lead.date)} />
                <DetailItem label="CMPT" value={lead.cmpt} />
                <DetailItem label="Prospects" value={lead.prospects} />
                <DetailItem
                  label="Quote"
                  value={
                    lead.quote !== null
                      ? formatLeadCurrency(lead.quote, lead.quoteCurrency)
                      : 'Not provided'
                  }
                />
                <DetailItem label="Comments" value={formatNullableText(lead.comments)} wide />
              </DetailSection>

              <DetailSection title="Activity">
                <DetailItem label="Created" value={formatNoteTimestamp(lead.createdAt)} />
                <DetailItem label="Last edited" value={formatNoteTimestamp(lead.updatedAt)} />
                {lead.convertedAt ? (
                  <DetailItem label="Converted" value={formatNoteTimestamp(lead.convertedAt)} />
                ) : null}
              </DetailSection>
            </CardContent>
          </Card>
        </div>

        <aside className="xl:sticky xl:top-24">
          <Card className="rounded-2xl border-border/70 shadow-sm xl:max-h-[calc(100vh-7rem)] xl:overflow-hidden">
            <CardHeader className="border-b border-border/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Comments</CardTitle>
                  <CardDescription>Lead-specific notes and follow-ups.</CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full">
                  {sortedNotes.length.toLocaleString()}
                </Badge>
              </div>
            </CardHeader>

            <div className="border-b border-border/70 bg-card p-3.5 sm:p-4">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAddComment();
                }}
              >
                <label
                  htmlFor="lead-detail-comment"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Add comment
                </label>
                <textarea
                  id="lead-detail-comment"
                  value={noteMessage}
                  rows={3}
                  onChange={(event) => setNoteMessage(event.target.value)}
                  placeholder="Add comment"
                  className={cn(
                    'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    noteError ? 'border-destructive/60' : null,
                  )}
                />
                {noteError ? <p className="text-sm text-destructive">{noteError}</p> : null}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 rounded-lg bg-[#ff5a00] px-3 text-xs text-white hover:bg-[#e65000]"
                    disabled={isSavingNote}
                  >
                    {isSavingNote ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <MessageSquarePlus className="h-4 w-4" />
                        Add comment
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>

            <CardContent className="min-h-0 space-y-3 p-3.5 sm:p-4 xl:max-h-[calc(100vh-24rem)] xl:overflow-y-auto">
              {notesError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {notesError}
                </div>
              ) : null}

              {isLoadingNotes ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
                  Loading comments...
                </div>
              ) : sortedNotes.length > 0 ? (
                <div className="space-y-3">
                  {sortedNotes.map((note) => (
                    <article
                      key={note.id}
                      className="rounded-xl border border-border/70 bg-secondary/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold text-foreground">{note.author.name}</p>
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {formatNoteTimestamp(note.createdAt)}
                        </time>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {note.message}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
                  No comments yet.
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function LeadStatusBadge({ status }: { status: LeadSummary['status'] | 'CONVERTED' }) {
  return (
    <Badge variant="outline" className="rounded-full px-3 py-1">
      {status === 'CONVERTED' ? 'Converted' : formatLeadStatusLabel(status)}
    </Badge>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/70 bg-secondary/20 p-3">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function DetailItem({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn('min-w-0', wide ? 'sm:col-span-2' : null)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function formatNullableText(value: string | null): string {
  return value?.trim() ? value : 'Not provided';
}

