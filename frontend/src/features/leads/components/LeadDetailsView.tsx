'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  History,
  LoaderCircle,
  Plus,
} from 'lucide-react';
import { DetailPageSkeleton } from '@/components/feedback/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { notesApi } from '@/features/notes/api/notes-api';
import type { NoteRecord } from '@/features/notes/types/note.types';
import { toast } from '@/lib/stores/toast.store';
import { cn } from '@/lib/utils/cn';
import {
  formatDateTime,
  formatRelativeTime,
} from '@/features/orders/lib/order-formatters';
import { leadsApi } from '../api/leads-api';
import { formatDate, formatLeadCurrency } from '../lib/lead-formatters';
import { formatLeadStatusLabel } from '../lib/leads.helpers';
import { LEAD_STATUSES, type LeadStatus, type LeadSummary } from '../types/lead.types';

type TimelineEntry = {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  body: ReactNode;
  badgeVariant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'neutral'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info';
};

export function LeadDetailsView({ leadId }: { leadId: string }) {
  const [lead, setLead] = useState<LeadSummary | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isNoteFormOpen, setIsNoteFormOpen] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
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
  const notesTimeline = useMemo(
    () =>
      sortedNotes.map((note) => ({
        id: note.id,
        timestamp: note.createdAt,
        actorName: note.author.name,
        action: 'Note',
        body: note.message,
        badgeVariant: 'secondary' as const,
      })),
    [sortedNotes],
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
      setIsNoteFormOpen(false);
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

  const handleStatusChange = async (nextStatus: LeadStatus) => {
    if (!lead || lead.isConverted || nextStatus === lead.status || isSavingStatus) {
      return;
    }

    setIsSavingStatus(true);

    try {
      const updatedLead = await leadsApi.update(lead.id, buildLeadStatusUpdatePayload(lead, nextStatus));
      setLead(updatedLead);
      toast.success(
        'Lead status updated',
        `Status changed to ${formatLeadStatusLabel(updatedLead.status)}.`,
      );
    } catch (caughtError) {
      toast.error(
        'Unable to update status',
        caughtError instanceof Error
          ? caughtError.message
          : 'Please try again in a moment.',
      );
    } finally {
      setIsSavingStatus(false);
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
    <section className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] xl:grid-cols-[minmax(0,1.08fr)_minmax(430px,0.92fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-xl">Lead details</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 p-3.5 sm:p-4">
              <DetailSection title="Basic Lead Info" tone="orange">
                <DetailBlock label="Lead date" value={formatDate(lead.date)} />
                <DetailBlock label="Advisor name" value={lead.createdBy.name} />
                <DetailBlock label="CMPT" value={lead.cmpt} />
                <DetailBlock
                  label="Status"
                  value={
                    lead.isConverted ? (
                      <LeadStatusBadge status={status} />
                    ) : (
                      <LeadStatusSelect
                        status={lead.status}
                        isSaving={isSavingStatus}
                        onChange={(nextStatus) => void handleStatusChange(nextStatus)}
                      />
                    )
                  }
                />
              </DetailSection>

              <DetailSection title="Customer Info" tone="blue">
                <DetailBlock label="Name" value={lead.customerName} />
                <DetailBlock label="Mobile" value={lead.customerPhone} />
                <DetailBlock label="Email" value={formatNullableText(lead.customerEmail)} />
                <DetailBlock label="State" value={formatNullableText(lead.state)} />
              </DetailSection>

              <DetailSection title="Vehicle / Part Info" tone="teal">
                <DetailBlock label="Parts" value={lead.partDescription} />
                <DetailBlock label="Make" value={formatNullableText(lead.vehicleMake)} />
                <DetailBlock label="Model" value={formatNullableText(lead.vehicleModel)} />
                <DetailBlock label="Year" value={formatNullableText(lead.vehicleYear)} />
                <DetailBlock label="Part" value={formatNullableText(lead.vehicleVariant)} />
                <DetailBlock label="Description" value={lead.partDescription} />
              </DetailSection>

              <DetailSection title="Sales Info" tone="green">
                <DetailBlock
                  label="Quote"
                  value={
                    lead.quote !== null
                      ? formatLeadCurrency(lead.quote, lead.quoteCurrency)
                      : 'Not provided'
                  }
                />
                <DetailBlock label="Currency" value={lead.quoteCurrency} />
                <DetailBlock label="Prospects" value={formatNullableText(lead.prospects)} />
                <DetailBlock label="Comments" value={formatNullableText(lead.comments)} />
              </DetailSection>

              <DetailSection title="Activity" tone="amber">
                <DetailBlock label="Created" value={formatDateTime(lead.createdAt)} />
                <DetailBlock label="Last edited" value={formatDateTime(lead.updatedAt)} />
                {lead.convertedAt ? (
                  <DetailBlock label="Converted" value={formatDateTime(lead.convertedAt)} />
                ) : null}
              </DetailSection>
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden lg:flex lg:max-h-[calc(100vh-3rem)] lg:flex-col">
            <CardHeader className="border-b border-border/70 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-4 w-4 text-primary" />
                  NOTES
                </CardTitle>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-lg bg-[#ff5a00] px-3 text-xs text-white hover:bg-[#e65000]"
                  onClick={() => {
                    setIsNoteFormOpen((currentValue) => !currentValue);
                    setNoteError(null);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add note
                </Button>
              </div>
            </CardHeader>

            {isNoteFormOpen ? (
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
                    Add note
                  </label>
                  <textarea
                    id="lead-detail-comment"
                    value={noteMessage}
                    rows={3}
                    onChange={(event) => setNoteMessage(event.target.value)}
                    placeholder="Add note"
                    className={cn(
                      'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      noteError ? 'border-destructive/60' : null,
                    )}
                  />
                  {noteError ? (
                    <p className="text-sm text-destructive">{noteError}</p>
                  ) : null}
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg px-3 text-xs"
                      disabled={isSavingNote}
                      onClick={() => {
                        setIsNoteFormOpen(false);
                        setNoteError(null);
                      }}
                    >
                      Cancel
                    </Button>
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
                        'Submit'
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}

            <CardContent className="min-h-0 space-y-3 p-3.5 sm:p-4 lg:flex-1 lg:overflow-y-auto">
              {notesError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {notesError}
                </div>
              ) : null}

              {isLoadingNotes ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
                  Loading notes...
                </div>
              ) : (
                <RemarkTimeline
                  entries={notesTimeline}
                  emptyMessage="No internal notes yet."
                />
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

function LeadStatusSelect({
  status,
  isSaving,
  onChange,
}: {
  status: LeadStatus;
  isSaving: boolean;
  onChange: (status: LeadStatus) => void;
}) {
  return (
    <div className="flex max-w-xs items-center gap-2">
      <Select
        value={status}
        disabled={isSaving}
        className="h-8 rounded-full border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700 shadow-none focus-visible:ring-orange-300 dark:border-orange-900/50 dark:bg-slate-950 dark:text-orange-300"
        onChange={(event) => onChange(event.target.value as LeadStatus)}
      >
        {LEAD_STATUSES.map((leadStatus) => (
          <option key={leadStatus} value={leadStatus}>
            {formatLeadStatusLabel(leadStatus)}
          </option>
        ))}
      </Select>
      {isSaving ? (
        <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}

function buildLeadStatusUpdatePayload(
  lead: LeadSummary,
  status: LeadStatus,
) {
  return {
    leadDate: lead.date,
    cmpt: lead.cmpt,
    customerPhone: lead.customerPhone,
    customerName: lead.customerName,
    customerEmail: lead.customerEmail ?? undefined,
    state: lead.state ?? undefined,
    vehicleYear: lead.vehicleYear ?? '',
    vehicleMake: lead.vehicleMake ?? '',
    vehicleModel: lead.vehicleModel ?? '',
    vehicleVariant: lead.vehicleVariant ?? undefined,
    quote: lead.quote ?? undefined,
    quoteCurrency: lead.quoteCurrency,
    comments: lead.comments ?? undefined,
    prospects: lead.prospects,
    status,
  };
}

function DetailSection({
  title,
  tone = 'slate',
  children,
}: {
  title: string;
  tone?: DetailTone;
  children: ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border p-3 shadow-sm', getDetailToneClassName(tone))}>
      <h3 className="text-xs font-bold uppercase tracking-[0.16em]">
        {title}
      </h3>
      <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[7.25rem_minmax(0,1fr)] gap-2 text-xs leading-5">
      <p className="font-bold uppercase text-foreground/85">
        {label}
      </p>
      <div className="min-w-0 whitespace-pre-wrap font-medium text-foreground">
        {value}
      </div>
    </div>
  );
}

type DetailTone = 'orange' | 'blue' | 'teal' | 'amber' | 'sky' | 'green' | 'slate';

function getDetailToneClassName(tone: DetailTone) {
  const classes: Record<DetailTone, string> = {
    orange:
      'border-orange-200 bg-orange-50/70 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-200',
    blue:
      'border-blue-200 bg-blue-50/70 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200',
    teal:
      'border-teal-200 bg-teal-50/70 text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/20 dark:text-teal-200',
    amber:
      'border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200',
    sky:
      'border-sky-200 bg-sky-50/70 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200',
    green:
      'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200',
    slate:
      'border-border bg-secondary/20 text-foreground',
  };

  return classes[tone];
}

function RemarkTimeline({
  entries,
  emptyMessage,
}: {
  entries: TimelineEntry[];
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className="relative space-y-3 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
      {entries.map((entry) => (
        <RemarkItem key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}

function RemarkItem({ entry }: { entry: TimelineEntry }) {
  return (
    <li className="relative pl-6">
      <span
        className={cn(
          'absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background',
          getTimelineDotClassName(entry.badgeVariant),
        )}
      />
      <div className="space-y-1">
        <p className="text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-[#d94d00] dark:text-orange-300">
            {entry.actorName}
          </span>{' '}
          | {formatDateTime(entry.timestamp)} ({formatRelativeTime(entry.timestamp)})
        </p>
        <div className="whitespace-pre-wrap text-xs font-medium leading-5 text-foreground">
          {entry.body}
        </div>
      </div>
    </li>
  );
}

function getTimelineDotClassName(variant?: TimelineEntry['badgeVariant']) {
  switch (variant) {
    case 'warning':
      return 'bg-amber-500';
    case 'success':
      return 'bg-emerald-500';
    case 'danger':
      return 'bg-red-500';
    case 'info':
      return 'bg-sky-500';
    default:
      return 'bg-teal-500';
  }
}

function formatNullableText(value: string | null): string {
  return value?.trim() ? value : 'Not provided';
}

