'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import { getErrorMessage } from '@/lib/utils/error';
import { leadsApi } from '../api/leads-api';
import {
  createLeadFormSchema,
  type CreateLeadFormValues,
} from '../schemas/lead.schema';
import type { LeadSummary } from '../types/lead.types';
import { LEAD_STATUSES } from '../types/lead.types';
import { formatLeadStatusLabel } from '../lib/leads.helpers';

const defaultValues: CreateLeadFormValues = {
  leadDate: '',
  cmpt: '',
  customerPhone: '',
  customerName: '',
  partDescription: '',
  quote: undefined,
  comments: '',
  prospects: '',
  status: 'PROSPECT',
};

function buildDefaultValues(lead?: LeadSummary | null): CreateLeadFormValues {
  if (!lead) {
    return defaultValues;
  }

  return {
    leadDate: lead.date,
    cmpt: lead.cmpt,
    customerPhone: lead.customerPhone,
    customerName: lead.customerName,
    partDescription: lead.partDescription,
    quote: lead.quote ?? undefined,
    comments: lead.comments ?? '',
    prospects: lead.prospects,
    status: lead.status,
  };
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function CreateLeadForm({
  adviserName,
  initialLead,
  onSaved,
}: {
  adviserName: string;
  initialLead?: LeadSummary | null;
  onSaved: (lead: LeadSummary) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CreateLeadFormValues>({
    resolver: zodResolver(createLeadFormSchema),
    defaultValues: buildDefaultValues(initialLead),
  });

  useEffect(() => {
    form.reset(buildDefaultValues(initialLead));
  }, [form, initialLead]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      const payload = createLeadFormSchema.parse(values);
      const savedLead = initialLead
        ? await leadsApi.update(initialLead.id, payload)
        : await leadsApi.create(payload);
      onSaved(savedLead);
      form.reset(defaultValues);
    } catch (error) {
      setFormError(
        getErrorMessage(error, 'Unable to create the lead right now. Please try again.'),
      );
    }
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="rounded-[1.5rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(59,130,246,0.10),rgba(255,255,255,0.92))] p-4 shadow-sm md:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="font-[var(--font-heading)] text-lg font-semibold tracking-[-0.03em] text-foreground">
              Sales lead intake
            </p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Capture the customer conversation once, then convert it into an order
              when it is ready to move.
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3 rounded-[1.5rem] border border-border/70 bg-white/90 p-4 shadow-sm md:p-5">
        <div className="space-y-1">
          <h3 className="font-[var(--font-heading)] text-base font-semibold tracking-[-0.02em] text-foreground">
            Lead details
          </h3>
          <p className="text-sm text-muted-foreground">
            Keep the sales adviser visible and capture the essentials the team needs.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field
            id="leadDate"
            label="Date"
            error={form.formState.errors.leadDate?.message?.toString()}
          >
            <Input
              id="leadDate"
              type="date"
              className="h-11 rounded-xl"
              {...form.register('leadDate')}
            />
          </Field>

          <Field id="adviserName" label="Adviser">
            <Input
              id="adviserName"
              value={adviserName}
              readOnly
              disabled
              className="h-11 rounded-xl bg-secondary/30 text-foreground"
            />
          </Field>

          <Field
            id="cmpt"
            label="CMPT"
            error={form.formState.errors.cmpt?.message?.toString()}
          >
            <Input
              id="cmpt"
              placeholder="CMPT"
              className="h-11 rounded-xl"
              {...form.register('cmpt')}
            />
          </Field>

          <Field
            id="customerPhone"
            label="Phone number"
            error={form.formState.errors.customerPhone?.message?.toString()}
          >
            <Input
              id="customerPhone"
              placeholder="+1 (555) 123-4567"
              className="h-11 rounded-xl"
              {...form.register('customerPhone')}
            />
          </Field>

          <Field
            id="customerName"
            label="Customer name"
            error={form.formState.errors.customerName?.message?.toString()}
            className="xl:col-span-2"
          >
            <Input
              id="customerName"
              placeholder="Customer name"
              className="h-11 rounded-xl"
              {...form.register('customerName')}
            />
          </Field>

          <Field
            id="quote"
            label="Quote"
            error={form.formState.errors.quote?.message?.toString()}
          >
            <Input
              id="quote"
              inputMode="decimal"
              placeholder="0.00"
              className="h-11 rounded-xl"
              {...form.register('quote')}
            />
          </Field>

          <Field
            id="prospects"
            label="Disposition"
            error={form.formState.errors.prospects?.message?.toString()}
          >
            <Input
              id="prospects"
              placeholder="Add the lead disposition"
              className="h-11 rounded-xl"
              {...form.register('prospects')}
            />
          </Field>

          <Field
            id="status"
            label="Status"
            error={form.formState.errors.status?.message?.toString()}
          >
            <Select id="status" className="h-11 rounded-xl" {...form.register('status')}>
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatLeadStatusLabel(status)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            id="partDescription"
            label="Part description"
            error={form.formState.errors.partDescription?.message?.toString()}
            className="xl:col-span-4"
          >
            <Textarea
              id="partDescription"
              rows={3}
              placeholder="Describe the requested part"
              className="min-h-[92px] rounded-xl"
              {...form.register('partDescription')}
            />
          </Field>

          <Field
            id="comments"
            label="Comments"
            error={form.formState.errors.comments?.message?.toString()}
            className="xl:col-span-4"
          >
            <Textarea
              id="comments"
              rows={4}
              placeholder="Add follow-up details, fitment notes, or sales context"
              className="min-h-[112px] rounded-xl"
              {...form.register('comments')}
            />
          </Field>
        </div>
      </section>

      {formError ? (
        <div className="rounded-[1.35rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <div className="rounded-[1.5rem] border border-border/70 bg-white/90 p-4 shadow-sm">
        <Button
          type="submit"
          size="lg"
          className="h-11 w-full rounded-xl"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? initialLead
              ? 'Saving lead...'
              : 'Creating lead...'
            : initialLead
              ? 'Save changes'
              : 'Create lead'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
