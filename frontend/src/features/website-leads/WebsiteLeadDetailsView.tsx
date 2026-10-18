'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
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

const statusLabel: Record<WebsiteLeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  CLOSED: 'Closed',
  CONVERTED: 'Converted',
};

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm">{value || 'Not provided'}</dd>
    </div>
  );
}

export function WebsiteLeadDetailsView({ id }: { id: string }) {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
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
    if (!lead || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      setLead(await websiteLeadsApi.update(id, payload));
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
    if (!noteText.trim() || saving) return;
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
    <section className="space-y-5">
      {actionError ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(350px,0.95fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <CardTitle>{lead.customerName || 'Website inquiry'}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {lead.source === 'QUOTE' ? 'Quote request' : 'Part request'} ·
              Received {formatPacificDateTime(lead.submittedAt)}
            </p>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <div className="grid gap-4 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/20 sm:grid-cols-2">
              <Detail label="Phone" value={lead.customerPhone} />
              <Detail label="Email" value={lead.customerEmail} />
              <Detail label="State" value={lead.state} />
              <Detail label="ZIP" value={lead.zipCode} />
            </div>
            <div className="grid gap-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20 sm:grid-cols-2">
              <Detail label="Year" value={lead.vehicleYear} />
              <Detail label="Make" value={lead.vehicleMake} />
              <Detail label="Model" value={lead.vehicleModel} />
              <Detail label="VIN" value={lead.vin} />
              <Detail label="Requested part" value={lead.partRequested} />
            </div>
            {lead.message ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide">
                  Customer message
                </h3>
                <p className="whitespace-pre-wrap text-sm">{lead.message}</p>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
                <Select
                  value={lead.status}
                  disabled={saving || !!lead.convertedLeadId}
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
              <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Assigned agent
                {role === 'ADMIN' && !lead.convertedLeadId ? (
                  <Select
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
                    {lead.assignedTo?.name || 'Unassigned'}
                  </p>
                )}
              </label>
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
            <Detail label="Source page" value={lead.sourcePageUrl} />
            {lead.convertedLeadId ? (
              <Link
                className="inline-block text-sm font-semibold text-primary underline"
                href={`/leads/${lead.convertedLeadId}`}
              >
                Open converted lead
              </Link>
            ) : lead.status !== 'CONVERTED' ? (
              <Button onClick={() => setShowConvertForm((value) => !value)}>
                {showConvertForm ? 'Hide conversion form' : 'Convert to Lead'}
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <Card className="h-fit overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/70">
            <CardTitle>Notes</CardTitle>
            <Button
              size="sm"
              onClick={() => setShowNoteForm((value) => !value)}
            >
              <Plus className="h-4 w-4" /> Add note
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
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
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              notes.map((note) => (
                <article
                  key={note.id}
                  className="border-b border-border/70 pb-3"
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
      </div>
      {showConvertForm && conversionValues && !lead.convertedLeadId ? (
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
              onSaved={(converted) => router.push(`/leads/${converted.id}`)}
            />
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
