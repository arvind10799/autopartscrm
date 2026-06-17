'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ReceiptText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import { getErrorMessage } from '@/lib/utils/error';
import { ordersApi } from '../api/orders-api';
import { formatCurrency } from '../lib/order-formatters';
import {
  formatOrderPaymentMethodLabel,
  formatOrderStatusOptionLabel,
} from '../lib/orders.helpers';
import {
  createOrderFormSchema,
  type CreateOrderFormValues,
} from '../schemas/order.schema';
import {
  CREATE_ORDER_STATUSES,
  ORDER_PAYMENT_METHODS,
  type OrderSummary,
} from '../types/order.types';

const defaultValues: CreateOrderFormValues = {
  leadId: undefined,
  orderNumber: '',
  orderDate: '',
  customerName: '',
  partDescription: '',
  customerEmail: '',
  customerPhone: '',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  vehicleVariant: '',
  vehicleVin: '',
  vehicleNotes: '',
  vehicleConfiguration: '',
  billingAddress: '',
  billingPerson: '',
  billingPhone: '',
  shippingAddress: '',
  shippingPerson: '',
  shippingPhone: '',
  shippingAt: '',
  companyName: '',
  milesOffered: undefined,
  salePrice: '',
  basePrice: undefined,
  salesTax: undefined,
  shippingCharges: undefined,
  profit: undefined,
  total: '',
  partialPayment: undefined,
  quantity: '1',
  status: 'PARTIALLY_PAID',
  paymentMethod: undefined,
  note: '',
};

function buildCreateOrderFormValues(
  initialValues?: Partial<CreateOrderFormValues>,
): CreateOrderFormValues {
  return {
    ...defaultValues,
    ...initialValues,
  };
}

function formatCreateOrderStatusLabel(
  status: (typeof CREATE_ORDER_STATUSES)[number],
) {
  if (status === 'CONFIRMED') {
    return 'Paid';
  }

  return formatOrderStatusOptionLabel(status);
}

function getFieldErrorMessage(message: unknown): string {
  return typeof message === 'string' ? message : 'Invalid value.';
}

function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'space-y-3 rounded-[1.5rem] border border-border/70 bg-white/90 p-4 shadow-sm md:p-5',
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="font-[var(--font-heading)] text-base font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
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
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/80 px-3.5 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function CreateOrderForm({
  onCreated,
  initialValues,
}: {
  onCreated: (order: OrderSummary) => void;
  initialValues?: Partial<CreateOrderFormValues>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const resolvedInitialValues = buildCreateOrderFormValues(initialValues);
  const form = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderFormSchema),
    defaultValues: resolvedInitialValues,
  });
  const [status, total, partialPayment] = useWatch({
    control: form.control,
    name: ['status', 'total', 'partialPayment'],
  });

  const requiresPaymentMethod =
    status === 'PARTIALLY_PAID' || status === 'CONFIRMED';
  const totalValue = Number(total || 0);
  const partialPaymentValue = Number(partialPayment || 0);
  const remainingBalance = Math.max(totalValue - partialPaymentValue, 0);
  const displayStatus = status === 'CONFIRMED' ? 'CONFIRMED' : 'PARTIALLY_PAID';

  useEffect(() => {
    if (!requiresPaymentMethod) {
      form.setValue('paymentMethod', undefined, {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [form, requiresPaymentMethod]);

  useEffect(() => {
    form.reset(resolvedInitialValues);
  }, [
    form,
    resolvedInitialValues.basePrice,
    resolvedInitialValues.billingAddress,
    resolvedInitialValues.billingPerson,
    resolvedInitialValues.billingPhone,
    resolvedInitialValues.companyName,
    resolvedInitialValues.customerEmail,
    resolvedInitialValues.customerName,
    resolvedInitialValues.customerPhone,
    resolvedInitialValues.leadId,
    resolvedInitialValues.milesOffered,
    resolvedInitialValues.note,
    resolvedInitialValues.orderDate,
    resolvedInitialValues.orderNumber,
    resolvedInitialValues.partDescription,
    resolvedInitialValues.partialPayment,
    resolvedInitialValues.paymentMethod,
    resolvedInitialValues.profit,
    resolvedInitialValues.quantity,
    resolvedInitialValues.salePrice,
    resolvedInitialValues.salesTax,
    resolvedInitialValues.shippingAddress,
    resolvedInitialValues.shippingAt,
    resolvedInitialValues.shippingCharges,
    resolvedInitialValues.shippingPerson,
    resolvedInitialValues.shippingPhone,
    resolvedInitialValues.status,
    resolvedInitialValues.total,
    resolvedInitialValues.vehicleConfiguration,
    resolvedInitialValues.vehicleMake,
    resolvedInitialValues.vehicleModel,
    resolvedInitialValues.vehicleNotes,
    resolvedInitialValues.vehicleVariant,
    resolvedInitialValues.vehicleVin,
    resolvedInitialValues.vehicleYear,
  ]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      const payload = createOrderFormSchema.parse(values);
      const createdOrder = await ordersApi.create(payload);

      onCreated(createdOrder);
      form.reset(buildCreateOrderFormValues(initialValues));
    } catch (error) {
      setFormError(
        getErrorMessage(
          error,
          'Unable to create the order right now. Please try again.',
        ),
      );
    }
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <input type="hidden" {...form.register('leadId')} />
      <input type="hidden" {...form.register('quantity')} />

      <div className="rounded-[1.5rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(59,130,246,0.10),rgba(255,255,255,0.92))] p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="font-[var(--font-heading)] text-lg font-semibold tracking-[-0.03em] text-foreground">
                Sales intake workspace
              </p>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Keep the essential customer, part, and payment details visible in
                one pass while you build the order.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[25rem]">
            <MetricCard
              label="Status"
              value={formatCreateOrderStatusLabel(displayStatus)}
            />
            <MetricCard
              label="Partial paid"
              value={formatCurrency(partialPaymentValue || 0)}
            />
            <MetricCard
              label="Remaining due"
              value={formatCurrency(remainingBalance)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.95fr)]">
        <div className="space-y-4">
          <FormSection
            title="Order and customer"
            description="Front-load the information your team reaches for first."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field
                id="orderNumber"
                label="Order number"
                error={form.formState.errors.orderNumber?.message?.toString()}
                className="xl:col-span-2"
              >
                <Input
                  id="orderNumber"
                  placeholder="SO-2026-001"
                  className="h-11 rounded-xl"
                  {...form.register('orderNumber')}
                />
              </Field>

              <Field
                id="orderDate"
                label="Order date"
                error={form.formState.errors.orderDate?.message?.toString()}
              >
                <Input
                  id="orderDate"
                  type="date"
                  className="h-11 rounded-xl"
                  {...form.register('orderDate')}
                />
              </Field>

              <Field
                id="salePrice"
                label="Price offered"
                error={form.formState.errors.salePrice?.message?.toString()}
              >
                <Input
                  id="salePrice"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-11 rounded-xl"
                  {...form.register('salePrice')}
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
                  placeholder="Customer Name"
                  className="h-11 rounded-xl"
                  {...form.register('customerName')}
                />
              </Field>

              <Field
                id="customerPhone"
                label="Mobile"
                error={form.formState.errors.customerPhone?.message?.toString()}
              >
                <Input
                  id="customerPhone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  className="h-11 rounded-xl"
                  {...form.register('customerPhone')}
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
                  placeholder="buyer@metroparts.com"
                  className="h-11 rounded-xl"
                  {...form.register('customerEmail')}
                />
              </Field>

              <Field
                id="partDescription"
                label="Part description"
                error={form.formState.errors.partDescription?.message?.toString()}
                className="xl:col-span-4"
              >
                <Input
                  id="partDescription"
                  placeholder="Front brake pads, ceramic set"
                  className="h-11 rounded-xl"
                  {...form.register('partDescription')}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Vehicle and fitment"
            description="Keep the fitment picture tight without stretching the popup."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field
                id="vehicleMake"
                label="Make"
                error={form.formState.errors.vehicleMake?.message?.toString()}
              >
                <Input
                  id="vehicleMake"
                  className="h-11 rounded-xl"
                  {...form.register('vehicleMake')}
                />
              </Field>

              <Field
                id="vehicleModel"
                label="Model"
                error={form.formState.errors.vehicleModel?.message?.toString()}
              >
                <Input
                  id="vehicleModel"
                  className="h-11 rounded-xl"
                  {...form.register('vehicleModel')}
                />
              </Field>

              <Field
                id="vehicleYear"
                label="Year"
                error={form.formState.errors.vehicleYear?.message?.toString()}
              >
                <Input
                  id="vehicleYear"
                  className="h-11 rounded-xl"
                  {...form.register('vehicleYear')}
                />
              </Field>

              <Field
                id="vehicleVariant"
                label="Variant"
                error={form.formState.errors.vehicleVariant?.message?.toString()}
              >
                <Input
                  id="vehicleVariant"
                  className="h-11 rounded-xl"
                  {...form.register('vehicleVariant')}
                />
              </Field>

              <Field
                id="vehicleVin"
                label="VIN"
                error={form.formState.errors.vehicleVin?.message?.toString()}
                className="xl:col-span-2"
              >
                <Input
                  id="vehicleVin"
                  className="h-11 rounded-xl"
                  {...form.register('vehicleVin')}
                />
              </Field>

              <Field
                id="vehicleConfiguration"
                label="Configuration"
                error={form.formState.errors.vehicleConfiguration?.message?.toString()}
                className="xl:col-span-2"
              >
                <Input
                  id="vehicleConfiguration"
                  className="h-11 rounded-xl"
                  {...form.register('vehicleConfiguration')}
                />
              </Field>

              <Field
                id="vehicleNotes"
                label="Vehicle notes"
                error={form.formState.errors.vehicleNotes?.message?.toString()}
                className="xl:col-span-4"
              >
                <Textarea
                  id="vehicleNotes"
                  rows={3}
                  placeholder="Vehicle or part notes"
                  className="min-h-[92px] rounded-xl"
                  {...form.register('vehicleNotes')}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            title="Addresses and fulfillment"
            description="Billing and shipping details stay side by side for faster review."
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/20 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Billing
                </p>
                <div className="grid gap-3">
                  <Field
                    id="billingAddress"
                    label="Billing address"
                    error={form.formState.errors.billingAddress?.message?.toString()}
                  >
                    <Textarea
                      id="billingAddress"
                      rows={3}
                      className="min-h-[88px] rounded-xl"
                      {...form.register('billingAddress')}
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      id="billingPerson"
                      label="Billing person"
                      error={form.formState.errors.billingPerson?.message?.toString()}
                    >
                      <Input
                        id="billingPerson"
                        className="h-11 rounded-xl"
                        {...form.register('billingPerson')}
                      />
                    </Field>

                    <Field
                      id="billingPhone"
                      label="Billing phone"
                      error={form.formState.errors.billingPhone?.message?.toString()}
                    >
                      <Input
                        id="billingPhone"
                        className="h-11 rounded-xl"
                        {...form.register('billingPhone')}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/20 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Shipping
                </p>
                <div className="grid gap-3">
                  <Field
                    id="shippingAddress"
                    label="Shipping address"
                    error={form.formState.errors.shippingAddress?.message?.toString()}
                  >
                    <Textarea
                      id="shippingAddress"
                      rows={3}
                      className="min-h-[88px] rounded-xl"
                      {...form.register('shippingAddress')}
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      id="shippingPerson"
                      label="Shipping person"
                      error={form.formState.errors.shippingPerson?.message?.toString()}
                    >
                      <Input
                        id="shippingPerson"
                        className="h-11 rounded-xl"
                        {...form.register('shippingPerson')}
                      />
                    </Field>

                    <Field
                      id="shippingPhone"
                      label="Shipping phone"
                      error={form.formState.errors.shippingPhone?.message?.toString()}
                    >
                      <Input
                        id="shippingPhone"
                        className="h-11 rounded-xl"
                        {...form.register('shippingPhone')}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      id="shippingAt"
                      label="Shipping date"
                      error={form.formState.errors.shippingAt?.message?.toString()}
                    >
                      <Input
                        id="shippingAt"
                        type="date"
                        className="h-11 rounded-xl"
                        {...form.register('shippingAt')}
                      />
                    </Field>

                    <Field
                      id="companyName"
                      label="Company name"
                      error={form.formState.errors.companyName?.message?.toString()}
                    >
                      <Input
                        id="companyName"
                        className="h-11 rounded-xl"
                        {...form.register('companyName')}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>
          </FormSection>
        </div>

        <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <FormSection
            title="Commercials"
            description="Status, payment, and costing stay grouped for quick decisions."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                id="status"
                label="Status"
                error={form.formState.errors.status?.message?.toString()}
              >
                <Select
                  id="status"
                  className="h-11 rounded-xl"
                  {...form.register('status')}
                >
                  {CREATE_ORDER_STATUSES.map((nextStatus) => (
                    <option key={nextStatus} value={nextStatus}>
                      {formatCreateOrderStatusLabel(nextStatus)}
                    </option>
                  ))}
                </Select>
              </Field>

              {requiresPaymentMethod ? (
                <Field
                  id="paymentMethod"
                  label="Payment method"
                  error={form.formState.errors.paymentMethod?.message?.toString()}
                >
                  <Select
                    id="paymentMethod"
                    className="h-11 rounded-xl"
                    {...form.register('paymentMethod')}
                  >
                    <option value="">Select payment method</option>
                    {ORDER_PAYMENT_METHODS.map((paymentMethod) => (
                      <option key={paymentMethod} value={paymentMethod}>
                        {formatOrderPaymentMethodLabel(paymentMethod)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-3.5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Payment method
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a paid status to enable payment capture.
                  </p>
                </div>
              )}

              <Field
                id="milesOffered"
                label="Miles offered"
                error={form.formState.errors.milesOffered?.message?.toString()}
              >
                <Input
                  id="milesOffered"
                  inputMode="decimal"
                  className="h-11 rounded-xl"
                  {...form.register('milesOffered')}
                />
              </Field>

              <Field
                id="basePrice"
                label="Base price"
                error={form.formState.errors.basePrice?.message?.toString()}
              >
                <Input
                  id="basePrice"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-11 rounded-xl"
                  {...form.register('basePrice')}
                />
              </Field>

              <Field
                id="salesTax"
                label="Sales tax"
                error={form.formState.errors.salesTax?.message?.toString()}
              >
                <Input
                  id="salesTax"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-11 rounded-xl"
                  {...form.register('salesTax')}
                />
              </Field>

              <Field
                id="shippingCharges"
                label="Shipping charges"
                error={form.formState.errors.shippingCharges?.message?.toString()}
              >
                <Input
                  id="shippingCharges"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-11 rounded-xl"
                  {...form.register('shippingCharges')}
                />
              </Field>

              <Field
                id="profit"
                label="Profit"
                error={form.formState.errors.profit?.message?.toString()}
              >
                <Input
                  id="profit"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-11 rounded-xl"
                  {...form.register('profit')}
                />
              </Field>

              <Field
                id="total"
                label="Total"
                error={form.formState.errors.total?.message?.toString()}
              >
                <Input
                  id="total"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-11 rounded-xl"
                  {...form.register('total')}
                />
              </Field>

              <Field
                id="partialPayment"
                label="Partial payment"
                error={form.formState.errors.partialPayment?.message?.toString()}
              >
                <Input
                  id="partialPayment"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-11 rounded-xl"
                  {...form.register('partialPayment')}
                />
              </Field>
            </div>

            <div className="rounded-[1.35rem] border border-border/70 bg-secondary/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Payment snapshot
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Total"
                  value={formatCurrency(totalValue || 0)}
                />
                <MetricCard
                  label="Paid now"
                  value={formatCurrency(partialPaymentValue || 0)}
                />
                <MetricCard
                  label="Balance"
                  value={formatCurrency(remainingBalance)}
                />
              </div>
            </div>

            <Field
              id="note"
              label="Order note"
              error={form.formState.errors.note?.message?.toString()}
            >
              <Textarea
                id="note"
                rows={4}
                placeholder="Add a handoff note, customer update, or internal context for this order"
                className="min-h-[112px] rounded-xl"
                {...form.register('note')}
              />
            </Field>
          </FormSection>

          {formError ? (
            <div className="rounded-[1.35rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border border-border/70 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Ready to create
                </p>
                <p className="text-sm text-muted-foreground">
                  Review the amounts and submit from here.
                </p>
              </div>
              <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right text-primary">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                  Order total
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(totalValue || 0)}
                </p>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-4 h-11 w-full rounded-xl"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Creating order...' : 'Create order'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
