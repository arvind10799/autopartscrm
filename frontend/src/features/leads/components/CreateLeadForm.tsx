'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, UserRound } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { vehicleLookupApi } from '@/features/vehicle-lookup/api/vehicle-lookup-api';
import { VehicleCombobox } from '@/features/vehicle-lookup/components/VehicleCombobox';
import type { VehicleLookupOption } from '@/features/vehicle-lookup/types/vehicle-lookup.types';
import { formatUsPhoneNumber } from '@/lib/forms/phone-format';
import { getPacificTodayDateInputValue } from '@/lib/utils/pacific-date';
import { cn } from '@/lib/utils/cn';
import { getErrorMessage } from '@/lib/utils/error';
import { leadsApi } from '../api/leads-api';
import {
  createLeadFormSchema,
  type CreateLeadFormValues,
} from '../schemas/lead.schema';
import type { LeadSummary } from '../types/lead.types';
import { LEAD_QUOTE_CURRENCIES, LEAD_STATUSES } from '../types/lead.types';
import { formatLeadStatusLabel } from '../lib/leads.helpers';

const defaultValues: CreateLeadFormValues = {
  leadDate: '',
  cmpt: '',
  customerPhone: '',
  customerName: '',
  customerEmail: '',
  state: '',
  vehicleYear: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleVariant: '',
  quote: undefined,
  quoteCurrency: 'USD',
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
    customerPhone: formatUsPhoneNumber(lead.customerPhone),
    customerName: lead.customerName,
    customerEmail: lead.customerEmail ?? '',
    state: lead.state ?? '',
    vehicleYear: lead.vehicleYear ?? '',
    vehicleMake: lead.vehicleMake ?? '',
    vehicleModel: lead.vehicleModel ?? '',
    vehicleVariant: lead.vehicleVariant ?? '',
    quote: lead.quote ?? undefined,
    quoteCurrency: lead.quoteCurrency,
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
  initialLead,
  onSaved,
}: {
  initialLead?: LeadSummary | null;
  onSaved: (lead: LeadSummary) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [yearOptions, setYearOptions] = useState<VehicleLookupOption[]>([]);
  const [makeOptions, setMakeOptions] = useState<VehicleLookupOption[]>([]);
  const [modelOptions, setModelOptions] = useState<VehicleLookupOption[]>([]);
  const [partOptions, setPartOptions] = useState<VehicleLookupOption[]>([]);
  const [isLoadingMakes, setIsLoadingMakes] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingParts, setIsLoadingParts] = useState(false);
  const [vehicleLookupNotice, setVehicleLookupNotice] = useState<string | null>(null);
  const form = useForm<CreateLeadFormValues>({
    resolver: zodResolver(createLeadFormSchema),
    defaultValues: buildDefaultValues(initialLead),
  });
  const maxLeadDate = getPacificTodayDateInputValue();
  const customerPhoneInput = form.register('customerPhone');
  const handleCustomerPhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = formatUsPhoneNumber(event.target.value);
    void customerPhoneInput.onChange(event);
  };
  const [vehicleYear, vehicleMake, vehicleModel, vehicleVariant] = useWatch({
    control: form.control,
    name: ['vehicleYear', 'vehicleMake', 'vehicleModel', 'vehicleVariant'],
  });
  const selectedVehicleYear = typeof vehicleYear === 'string' ? vehicleYear : '';
  const selectedVehicleMake = typeof vehicleMake === 'string' ? vehicleMake : '';
  const selectedVehicleModel = typeof vehicleModel === 'string' ? vehicleModel : '';
  const selectedVehicleVariant =
    typeof vehicleVariant === 'string' ? vehicleVariant : '';

  useEffect(() => {
    form.reset(buildDefaultValues(initialLead));
  }, [form, initialLead]);

  useEffect(() => {
    let isActive = true;

    vehicleLookupApi
      .getYears()
      .then((response) => {
        if (isActive) {
          setYearOptions(response.items);
        }
      })
      .catch(() => {
        if (isActive) {
          setVehicleLookupNotice(
            'Vehicle year options are unavailable. You can still type manually.',
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    setIsLoadingMakes(true);
    vehicleLookupApi
      .getMakes()
      .then((response) => {
        if (isActive) {
          setMakeOptions(response.items);
          setVehicleLookupNotice(null);
        }
      })
      .catch(() => {
        if (isActive) {
          setVehicleLookupNotice(
            'Vehicle make options are unavailable. You can still type manually.',
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingMakes(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const make =
      typeof vehicleMake === 'string' && vehicleMake.trim().length > 0
        ? vehicleMake.trim()
        : '';
    const year =
      typeof vehicleYear === 'string' && vehicleYear.trim().length > 0
        ? vehicleYear.trim()
        : undefined;

    if (!make) {
      setModelOptions([]);
      return () => {
        isActive = false;
      };
    }

    setIsLoadingModels(true);
    vehicleLookupApi
      .getModels({ make, year })
      .then((response) => {
        if (isActive) {
          setModelOptions(response.items);
          setVehicleLookupNotice(null);
        }
      })
      .catch(() => {
        if (isActive) {
          setVehicleLookupNotice(
            'Vehicle model options are unavailable. You can still type manually.',
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingModels(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [vehicleMake, vehicleYear]);

  useEffect(() => {
    let isActive = true;

    setIsLoadingParts(true);
    vehicleLookupApi
      .getParts()
      .then((response) => {
        if (isActive) {
          setPartOptions(response.items);
          setVehicleLookupNotice(null);
        }
      })
      .catch(() => {
        if (isActive) {
          setVehicleLookupNotice(
            'Vehicle part options are unavailable. You can still type manually.',
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingParts(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

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
            Capture the essentials the team needs for qualification and order conversion.
          </p>
        </div>

        {vehicleLookupNotice ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {vehicleLookupNotice}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field
            id="leadDate"
            label="Date"
            error={form.formState.errors.leadDate?.message?.toString()}
          >
            <Input
              id="leadDate"
              type="date"
              max={maxLeadDate}
              className="h-11 rounded-xl"
              {...form.register('leadDate')}
            />
          </Field>

          <Field
            id="cmpt"
            label="CMPT"
            error={form.formState.errors.cmpt?.message?.toString()}
          >
            <Select id="cmpt" className="h-11 rounded-xl" {...form.register('cmpt')}>
              <option value="">Select CMPT</option>
              <option value="YES">YES</option>
              <option value="NO">NO</option>
            </Select>
          </Field>

          <Field
            id="customerPhone"
            label="Phone number"
            error={form.formState.errors.customerPhone?.message?.toString()}
          >
            <Input
              id="customerPhone"
              type="tel"
              maxLength={14}
              placeholder="(555) 555-1234"
              className="h-11 rounded-xl"
              {...customerPhoneInput}
              onChange={handleCustomerPhoneChange}
            />
          </Field>

          <Field
            id="customerName"
            label="Customer name"
            error={form.formState.errors.customerName?.message?.toString()}
          >
            <Input
              id="customerName"
              placeholder="Customer name"
              className="h-11 rounded-xl"
              {...form.register('customerName')}
            />
          </Field>

          <Field
            id="customerEmail"
            label="Email"
            error={form.formState.errors.customerEmail?.message?.toString()}
          >
            <Input
              id="customerEmail"
              type="email"
              placeholder="customer@example.com"
              className="h-11 rounded-xl"
              {...form.register('customerEmail')}
            />
          </Field>

          <Field
            id="state"
            label="State"
            error={form.formState.errors.state?.message?.toString()}
          >
            <Input
              id="state"
              placeholder="State"
              className="h-11 rounded-xl"
              {...form.register('state')}
            />
          </Field>

          <Field
            id="vehicleYear"
            label="Year"
            error={form.formState.errors.vehicleYear?.message?.toString()}
          >
            <VehicleCombobox
              id="vehicleYear"
              value={selectedVehicleYear}
              options={yearOptions}
              placeholder="Select or type year"
              onChange={(nextValue) => {
                form.setValue('vehicleYear', nextValue, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                form.setValue('vehicleModel', '', {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
          </Field>

          <Field
            id="vehicleMake"
            label="Make"
            error={form.formState.errors.vehicleMake?.message?.toString()}
          >
            <VehicleCombobox
              id="vehicleMake"
              value={selectedVehicleMake}
              options={makeOptions}
              disabled={isLoadingMakes && makeOptions.length === 0}
              placeholder={isLoadingMakes ? 'Loading makes...' : 'Select or type make'}
              onChange={(nextValue) => {
                form.setValue('vehicleMake', nextValue, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                form.setValue('vehicleModel', '', {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
          </Field>

          <Field
            id="vehicleModel"
            label="Model"
            error={form.formState.errors.vehicleModel?.message?.toString()}
          >
            <VehicleCombobox
              id="vehicleModel"
              value={selectedVehicleModel}
              options={modelOptions}
              disabled={!selectedVehicleMake || (isLoadingModels && modelOptions.length === 0)}
              placeholder={
                isLoadingModels
                  ? 'Loading models...'
                  : selectedVehicleMake
                    ? 'Select or type model'
                    : 'Select make first'
              }
              onChange={(nextValue) =>
                form.setValue('vehicleModel', nextValue, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </Field>

          <Field
            id="vehicleVariant"
            label="Variant"
            error={form.formState.errors.vehicleVariant?.message?.toString()}
          >
            <VehicleCombobox
              id="vehicleVariant"
              value={selectedVehicleVariant}
              options={partOptions}
              disabled={isLoadingParts && partOptions.length === 0}
              placeholder={isLoadingParts ? 'Loading parts...' : 'Select or type part'}
              onChange={(nextValue) =>
                form.setValue('vehicleVariant', nextValue, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </Field>

          <Field
            id="quote"
            label="Quote"
            error={form.formState.errors.quote?.message?.toString()}
          >
            <div className="flex h-11 overflow-hidden rounded-xl border border-input bg-white shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Select
                id="quoteCurrency"
                aria-label="Quote currency"
                className="h-full w-24 rounded-none border-0 bg-secondary/50 px-3 text-sm font-semibold shadow-none focus-visible:ring-0"
                {...form.register('quoteCurrency')}
              >
                {LEAD_QUOTE_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
              <Input
                id="quote"
                inputMode="decimal"
                placeholder="0.00"
                className="h-full flex-1 rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                {...form.register('quote')}
              />
            </div>
            {form.formState.errors.quoteCurrency ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.quoteCurrency.message?.toString()}
              </p>
            ) : null}
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
