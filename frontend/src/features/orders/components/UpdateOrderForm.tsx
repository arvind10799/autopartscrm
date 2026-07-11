'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, History, PencilLine, RotateCcw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/utils/error';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ordersApi } from '../api/orders-api';
import { formatDateTime } from '../lib/order-formatters';
import { useOrderDetailWithRefresh } from '../hooks/useOrderDetail';
import {
  updateOrderFormSchema,
  type UpdateOrderFormValues,
} from '../schemas/order.schema';
import type { OrderNote, OrderSummary } from '../types/order.types';
import {
  ORDER_PAYMENT_METHODS,
  ORDER_STATUSES,
} from '../types/order.types';
import {
  formatOrderPaymentMethod,
  formatOrderStatus,
} from '../lib/order-formatters';

function getFieldErrorMessage(message: unknown): string {
  return typeof message === 'string' ? message : 'Invalid value.';
}

function isHistoryNote(note: OrderNote): boolean {
  return note.content.startsWith('Order updated:');
}

export function UpdateOrderForm({
  orderId,
  onUpdated,
  onCancel,
}: {
  orderId: string;
  onUpdated: (order: OrderSummary) => void;
  onCancel: () => void;
}) {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === 'ADMIN';
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { order, isLoading, error } = useOrderDetailWithRefresh(orderId, refreshKey);
  const form = useForm<UpdateOrderFormValues>({
    resolver: zodResolver(updateOrderFormSchema),
    defaultValues: {
      customerEmail: '',
      customerPhone: '',
      customerName: '',
      partDescription: '',
      price: '',
      total: '',
      status: undefined,
      paymentMethod: '',
      advisorName: '',
      orderDate: '',
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
      milesOffered: '',
      basePrice: '',
      salesTax: '',
      shippingCharges: '',
      profit: '',
      partialPayment: '',
      note: '',
    },
  });

  useEffect(() => {
    if (!order) {
      return;
    }

    form.reset({
      customerEmail: order.customerEmail ?? '',
      customerPhone: order.customerPhone ?? '',
      customerName: order.customerName,
      partDescription: order.partDescription,
      price: String(order.salePrice),
      total: String(order.totalSaleAmount),
      status: order.status,
      paymentMethod: order.paymentMethod ?? '',
      advisorName: order.intakeDetails.advisorName ?? '',
      orderDate: order.intakeDetails.orderDate ?? '',
      vehicleMake: order.intakeDetails.vehicleMake ?? '',
      vehicleModel: order.intakeDetails.vehicleModel ?? '',
      vehicleYear: order.intakeDetails.vehicleYear ?? '',
      vehicleVariant: order.intakeDetails.vehicleVariant ?? '',
      vehicleVin: order.intakeDetails.vehicleVin ?? '',
      vehicleNotes: order.intakeDetails.vehicleNotes ?? '',
      vehicleConfiguration: order.intakeDetails.vehicleConfiguration ?? '',
      billingAddress: order.intakeDetails.billingAddress ?? '',
      billingPerson: order.intakeDetails.billingPerson ?? '',
      billingPhone: order.intakeDetails.billingPhone ?? '',
      shippingAddress: order.intakeDetails.shippingAddress ?? '',
      shippingPerson: order.intakeDetails.shippingPerson ?? '',
      shippingPhone: order.intakeDetails.shippingPhone ?? '',
      shippingAt: order.intakeDetails.shippingAt ?? '',
      companyName: order.intakeDetails.companyName ?? '',
      milesOffered: order.intakeDetails.milesOffered?.toString() ?? '',
      basePrice: order.intakeDetails.basePrice?.toString() ?? '',
      salesTax: order.intakeDetails.salesTax?.toString() ?? '',
      shippingCharges: order.intakeDetails.shippingCharges?.toString() ?? '',
      profit: order.intakeDetails.profit?.toString() ?? '',
      partialPayment: order.intakeDetails.partialPayment?.toString() ?? '',
      note: '',
    });
  }, [form, order]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      const parsedPayload = updateOrderFormSchema.parse(values);
      const payload = isAdmin
        ? parsedPayload
        : {
            customerEmail: parsedPayload.customerEmail,
            customerPhone: parsedPayload.customerPhone,
            note: parsedPayload.note,
          };
      const updatedOrder = await ordersApi.update(orderId, payload);

      onUpdated(updatedOrder);
      setRefreshKey((currentValue) => currentValue + 1);
      form.reset({
        ...values,
        customerEmail: payload.customerEmail ?? '',
        customerPhone: payload.customerPhone ?? '',
        note: '',
      });
    } catch (submitError) {
      setFormError(
        getErrorMessage(
          submitError,
          'Unable to edit the order right now. Please try again.',
        ),
      );
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Loading order editor</p>
            <p className="text-sm text-muted-foreground">
              Pulling the latest notes and edit history.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
          {error ?? 'Order details are unavailable.'}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setRefreshKey((currentValue) => currentValue + 1)}
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-secondary/35 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
            <PencilLine className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Edit order</p>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? `Update all order information and add notes for ${order.orderNumber}.`
                : `Update customer contact details and add notes for ${order.orderNumber}.`}
            </p>
          </div>
        </div>
      </div>

      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="orderNumberReadonly">Order number</Label>
            <Input id="orderNumberReadonly" value={order.orderNumber} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partDescriptionReadonly">Part description</Label>
            <Input
              id="partDescriptionReadonly"
              value={order.partDescription}
              readOnly
            />
          </div>
        </div>

        {isAdmin ? (
          <>
            <EditorSection title="Admin order fields">
              <EditorField label="Customer name" id="customerName">
                <Input id="customerName" {...form.register('customerName')} />
              </EditorField>
              <EditorField label="Part description" id="partDescription">
                <Input id="partDescription" {...form.register('partDescription')} />
              </EditorField>
              <EditorField label="Advisor name" id="advisorName">
                <Input id="advisorName" {...form.register('advisorName')} />
              </EditorField>
              <EditorField label="Order date" id="orderDate">
                <Input id="orderDate" type="date" {...form.register('orderDate')} />
              </EditorField>
              <EditorField label="Sale price" id="price">
                <Input id="price" inputMode="decimal" {...form.register('price')} />
              </EditorField>
              <EditorField label="Total sale amount" id="total">
                <Input id="total" inputMode="decimal" {...form.register('total')} />
              </EditorField>
              <EditorField label="Order status" id="status">
                <Select id="status" {...form.register('status')}>
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatOrderStatus(status)}
                    </option>
                  ))}
                </Select>
              </EditorField>
              <EditorField label="Payment method" id="paymentMethod">
                <Select id="paymentMethod" {...form.register('paymentMethod')}>
                  <option value="">Not required</option>
                  {ORDER_PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {formatOrderPaymentMethod(method)}
                    </option>
                  ))}
                </Select>
              </EditorField>
            </EditorSection>

            <EditorSection title="Vehicle information">
              {[
                ['vehicleMake', 'Make'],
                ['vehicleModel', 'Model'],
                ['vehicleYear', 'Year'],
                ['vehicleVariant', 'Variant'],
                ['vehicleVin', 'VIN'],
                ['vehicleConfiguration', 'Configuration'],
              ].map(([field, label]) => (
                <EditorField key={field} label={label} id={field}>
                  <Input id={field} {...form.register(field as keyof UpdateOrderFormValues)} />
                </EditorField>
              ))}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vehicleNotes">Vehicle notes</Label>
                <Textarea id="vehicleNotes" rows={3} {...form.register('vehicleNotes')} />
              </div>
            </EditorSection>

            <EditorSection title="Billing and shipping">
              {[
                ['billingPerson', 'Billing person'],
                ['billingPhone', 'Billing phone'],
                ['shippingPerson', 'Shipping person'],
                ['shippingPhone', 'Shipping phone'],
                ['shippingAt', 'Shipping date'],
                ['companyName', 'Company name'],
              ].map(([field, label]) => (
                <EditorField key={field} label={label} id={field}>
                  <Input id={field} {...form.register(field as keyof UpdateOrderFormValues)} />
                </EditorField>
              ))}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="billingAddress">Billing address</Label>
                <Textarea id="billingAddress" rows={2} {...form.register('billingAddress')} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="shippingAddress">Shipping address</Label>
                <Textarea id="shippingAddress" rows={2} {...form.register('shippingAddress')} />
              </div>
            </EditorSection>

            <EditorSection title="Commercial details">
              {[
                ['milesOffered', 'Miles offered'],
                ['basePrice', 'Base price'],
                ['salesTax', 'Sales tax'],
                ['shippingCharges', 'Shipping charges'],
                ['profit', 'Profit'],
                ['partialPayment', 'Paid'],
              ].map(([field, label]) => (
                <EditorField key={field} label={label} id={field}>
                  <Input
                    id={field}
                    inputMode="decimal"
                    {...form.register(field as keyof UpdateOrderFormValues)}
                  />
                </EditorField>
              ))}
            </EditorSection>
          </>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customerEmail">Customer email</Label>
            <Input
              id="customerEmail"
              type="email"
              {...form.register('customerEmail')}
            />
            {form.formState.errors.customerEmail ? (
              <p className="text-sm text-destructive">
                {getFieldErrorMessage(form.formState.errors.customerEmail.message)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerPhone">Customer phone</Label>
            <Input
              id="customerPhone"
              type="tel"
              {...form.register('customerPhone')}
            />
            {form.formState.errors.customerPhone ? (
              <p className="text-sm text-destructive">
                {getFieldErrorMessage(form.formState.errors.customerPhone.message)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">
            Note <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="note"
            rows={4}
            placeholder="Add a note about this edit or customer update"
            {...form.register('note')}
          />
          {form.formState.errors.note ? (
            <p className="text-sm text-destructive">
              {getFieldErrorMessage(form.formState.errors.note.message)}
            </p>
          ) : null}
        </div>

        {formError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        <div className="flex gap-3">
          <Button
            type="submit"
            size="lg"
            className="flex-1"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Saving changes...' : 'Save order changes'}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={onCancel}>
            Close
          </Button>
        </div>
      </form>

      <div className="space-y-3 rounded-2xl border border-border/70 bg-white/80 p-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <p className="font-semibold text-foreground">Previous edit history and notes</p>
        </div>

        {order.notes.length > 0 ? (
          <div className="space-y-3">
            {order.notes.map((note) => (
              <div
                key={note.id}
                className="rounded-2xl border border-border/70 bg-secondary/20 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isHistoryNote(note) ? 'info' : 'secondary'}>
                    {isHistoryNote(note) ? 'Edit history' : 'Note'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {note.author.name} | {formatDateTime(note.createdAt)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
            No notes or edit history entries have been recorded for this order yet.
          </div>
        )}
      </div>
    </div>
  );
}

function EditorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-secondary/15 p-4">
      <h3 className="mb-4 font-semibold text-foreground">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function EditorField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
