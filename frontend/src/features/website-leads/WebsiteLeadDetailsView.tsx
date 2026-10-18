'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, UserRoundCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CreateLeadForm } from '@/features/leads/components/CreateLeadForm';
import type { CreateLeadFormValues } from '@/features/leads/schemas/lead.schema';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { useDetailReturnHref } from '@/lib/filters/table-view-state';
import { formatUsPhoneNumber } from '@/lib/forms/phone-format';
import {
  getPacificTodayDateInputValue,
  formatPacificDateTime,
} from '@/lib/utils/pacific-date';
import {
  websiteLeadsApi,
  WEBSITE_LEAD_STATUSES,
  type WebsiteLead,
  type WebsiteLeadAgent,
  type WebsiteLeadNote,
  type WebsiteLeadStatus,
} from './website-leads-api';
import {
  WebsiteLeadAssignmentBadge,
  WebsiteLeadStatusBadge,
} from './WebsiteLeadBadges';
import { useWebsiteLeadsSummary } from './WebsiteLeadsSummaryProvider';

const statusLabel: Record<WebsiteLeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  CLOSED: 'Closed',
  CONVERTED: 'Converted',
};

function Detail({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={`grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-2 text-xs leading-5 sm:grid-cols-[7.25rem_minmax(0,1fr)] ${className}`}>
      <span className="font-bold uppercase text-foreground/80">{label}</span>
      <span className="min-w-0 break-words font-medium text-foreground">{value || 'Not provided'}</span>
    </div>
  );
}

function DetailSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'orange' | 'blue' | 'teal' | 'green';
  children: ReactNode;
}) {
  const toneClass = {
    orange: 'border-orange-200 bg-orange-50/70 text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-200',
    blue: 'border-blue-200 bg-blue-50/70 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200',
    teal: 'border-teal-200 bg-teal-50/70 text-teal-800 dark:border-teal-900/50 dark:bg-teal-950/20 dark:text-teal-200',
    green: 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200',
  }[tone];

  return (
    <section className={`rounded-xl border p-3 shadow-sm ${toneClass}`}>
      <h3 className="text-xs font-bold uppercase tracking-[0.16em]">{title}</h3>
      <div className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function WebsiteLeadDetailsView({ id }: { id: string }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const { refresh: refreshSummary } = useWebsiteLeadsSummary();
  const returnHref = useDetailReturnHref('/website-leads');
  const [lead, setLead] = useState<WebsiteLead | null>(null);
  const [notes, setNotes] = useState<WebsiteLeadNote[]>([]);
  const [agents, setAgents] = useState<WebsiteLeadAgent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showConvertForm, setShowConvertForm] = useState(false);
  const conversionFormRef = useRef<HTMLDivElement | null>(null);
  const canManage =
    role === 'ADMIN' || (role === 'SALES' && lead?.assignedToId === user?.userId);
  const canClaim = role === 'SALES' && lead?.assignedToId === null &&
    !lead.convertedLeadId;

  useEffect(() => {
    if (!showConvertForm) return;
    const frame = window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      conversionFormRef.current?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showConvertForm]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([websiteLeadsApi.get(id), websiteLeadsApi.notes(id)])
      .then(([record, entries]) => {
        if (active) {
          setLead(record);
          setNotes(entries);
        }
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to load website lead.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (role !== 'ADMIN') return;
    void websiteLeadsApi
      .agents()
      .then(setAgents)
      .catch(() => setAgents([]));
  }, [role]);

  const conversionValues = useMemo<
    Partial<CreateLeadFormValues> | undefined
  >(() => {
    if (!lead) return undefined;
    const fullPart = lead.partRequested || '';
    const extraPart =
      fullPart.length > 80 ? `Requested part: ${fullPart}\n` : '';
    return {
      leadDate: getPacificTodayDateInputValue(new Date(lead.submittedAt)),
      cmpt: '',
      customerPhone: formatUsPhoneNumber(lead.customerPhone || ''),
      customerName: lead.customerName || '',
      customerEmail: lead.customerEmail || '',
      state: lead.state || '',
      vehicleYear: lead.vehicleYear || '',
      vehicleMake: lead.vehicleMake || '',
      vehicleModel: lead.vehicleModel || '',
      vehicleVariant: fullPart.slice(0, 80),
      comments: `${extraPart}${lead.message || ''}`.slice(0, 2000),
      status: 'PROSPECT',
    };
  }, [lead]);

  async function update(payload: {
    status?: WebsiteLeadStatus;
    assignedToId?: string | null;
  }) {
    if (!lead || !canManage || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      setLead(await websiteLeadsApi.update(id, payload));
      void refreshSummary();
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : 'Unable to update website lead.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function addNote() {
    if (!canManage || !noteText.trim() || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      const added = await websiteLeadsApi.addNote(id, noteText.trim());
      setNotes((current) => [added, ...current]);
      setNoteText('');
      setShowNoteForm(false);
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : 'Unable to add note.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function claim() {
    if (!canClaim || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      setLead(await websiteLeadsApi.claim(id));
      void refreshSummary();
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : 'This website lead could not be assigned. Refresh the list.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <p className="p-5 text-sm text-muted-foreground">Loading website lead…</p>
    );
  if (error || !lead)
    return (
      <Card className="p-5">
        <p className="text-sm text-destructive">
          {error || 'Website lead was not found.'}
        </p>
        <Link href={returnHref} className="mt-3 inline-block text-sm underline">
          Back to website leads
        </Link>
      </Card>
    );

  return (
    <section className="space-y-4">
      {actionError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      {canClaim ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900 dark:bg-orange-950/20">
          <div>
            <p className="font-semibold text-slate-950 dark:text-white">Available to claim</p>
            <p className="text-sm text-muted-foreground">
              Assign this inquiry to yourself to update its status, add notes, or convert it.
            </p>
          </div>
          <Button onClick={() => void claim()} disabled={saving}>
            <UserRoundCheck className="h-4 w-4" />
            {saving ? 'Assigning…' : 'Assign to me'}
          </Button>
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] xl:grid-cols-[minmax(0,1.08fr)_minmax(430px,0.92fr)]">
        <Card className="overflow-hidden border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{lead.customerName || 'Website inquiry'}</CardTitle>
              <WebsiteLeadStatusBadge status={lead.status} />
              <WebsiteLeadAssignmentBadge
                name={lead.assignedTo?.name || null}
                isMine={lead.assignedToId === user?.userId}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {lead.source === 'QUOTE' ? 'Quote request' : 'Part request'} ·
              Received {formatPacificDateTime(lead.submittedAt)}
            </p>
          </CardHeader>
          <CardContent className="space-y-3 p-3.5 sm:p-4">
            <DetailSection title="Customer contact" tone="orange">
              <Detail label="Phone" value={lead.customerPhone} />
              <Detail label="Email" value={lead.customerEmail} />
              <Detail label="State" value={lead.state} />
              <Detail label="ZIP" value={lead.zipCode} />
            </DetailSection>
            <DetailSection title="Vehicle and part" tone="teal">
              <Detail label="Requested part" value={lead.partRequested} className="sm:col-span-2" />
              <Detail label="Year" value={lead.vehicleYear} />
              <Detail label="Make" value={lead.vehicleMake} />
              <Detail label="Model" value={lead.vehicleModel} />
              <Detail label="VIN" value={lead.vin} />
            </DetailSection>
            {lead.message ? (
              <DetailSection title="Customer message" tone="green">
                <p className="whitespace-pre-wrap break-words text-xs leading-5 text-foreground sm:col-span-2">{lead.message}</p>
              </DetailSection>
            ) : null}
            <DetailSection title="Request handling" tone="blue">
              <label className="space-y-1 text-xs font-bold uppercase text-foreground/80">
                Status
                <Select
                  value={lead.status}
                  disabled={saving || !canManage || !!lead.convertedLeadId}
                  onChange={(event) =>
                    void update({
                      status: event.target.value as WebsiteLeadStatus,
                    })
                  }
                >
                  {WEBSITE_LEAD_STATUSES.filter(
                    (value) =>
                      value !== 'CONVERTED' || lead.status === 'CONVERTED',
                  ).map((value) => (
                    <option key={value} value={value}>
                      {statusLabel[value]}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="space-y-1 text-xs font-bold uppercase text-foreground/80">
                <p>Assigned agent</p>
                {role === 'ADMIN' && !lead.convertedLeadId ? (
                  <Select
                    aria-label="Assigned agent"
                    value={lead.assignedToId || ''}
                    disabled={saving}
                    onChange={(event) =>
                      void update({ assignedToId: event.target.value || null })
                    }
                  >
                    <option value="">Unassigned</option>
                    {agents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="pt-2 text-sm font-normal normal-case text-foreground">
                    {lead.assignedToId === user?.userId
                      ? 'Assigned to me'
                      : lead.assignedTo?.name || 'Unassigned'}
                  </p>
                )}
              </div>
              <Detail
                label="SMS opt-in"
                value={
                  lead.smsOptIn === null
                    ? 'Not recorded'
                    : lead.smsOptIn
                      ? 'Yes'
                      : 'No'
                }
              />
              <Detail label="Source page" value={lead.sourcePageUrl} className="sm:col-span-2" />
            </DetailSection>
            {lead.convertedLeadId ? (
              <Link
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline"
                href={`/leads/${lead.convertedLeadId}`}
              >
                Open converted CRM lead <ArrowRight className="h-4 w-4" />
              </Link>
            ) : lead.status !== 'CONVERTED' && canManage ? (
              <Button onClick={() => setShowConvertForm((value) => !value)}>
                {showConvertForm ? 'Hide conversion form' : 'Convert to Lead'}
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="overflow-hidden lg:flex lg:max-h-[calc(100vh-3rem)] lg:flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
              <div>
                <CardTitle className="text-lg">Notes</CardTitle>
                <p className="text-xs text-muted-foreground">Internal follow-up history</p>
              </div>
              {canManage ? (
                <Button
                  size="sm"
                  onClick={() => setShowNoteForm((value) => !value)}
                >
                  <Plus className="h-4 w-4" /> Add note
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="min-h-0 space-y-3 p-3.5 sm:p-4 lg:flex-1 lg:overflow-y-auto">
              {showNoteForm ? (
                <div className="space-y-2">
                  <Textarea
                    value={noteText}
                    maxLength={1000}
                    onChange={(event) => setNoteText(event.target.value)}
                    placeholder="Add an internal note"
                  />
                  <Button
                    size="sm"
                    disabled={saving || !noteText.trim()}
                    onClick={() => void addNote()}
                  >
                    Save note
                  </Button>
                </div>
              ) : null}
              {notes.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                notes.map((note) => (
                  <article
                    key={note.id}
                    className="border-b border-border/70 pb-3 last:border-b-0 last:pb-0"
                  >
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">
                        {note.author.name}
                      </strong>{' '}
                      · {formatPacificDateTime(note.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {note.content}
                    </p>
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
      {showConvertForm && conversionValues && canManage && !lead.convertedLeadId ? (
        <div ref={conversionFormRef} className="scroll-mt-24 sm:scroll-mt-28">
          <Card>
            <CardHeader>
              <CardTitle>Convert to CRM lead</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review the imported details and complete every required field
                before saving.
              </p>
            </CardHeader>
            <CardContent>
              <CreateLeadForm
                initialValues={conversionValues}
                submitLabel="Convert to lead"
                onSubmitLead={(payload) => websiteLeadsApi.convert(id, payload)}
                onSaved={(converted) => {
                  void refreshSummary();
                  router.push(`/leads/${converted.id}`);
                }}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
