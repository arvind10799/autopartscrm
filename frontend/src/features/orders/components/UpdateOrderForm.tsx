'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, History, PencilLine, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/utils/error';
import { ordersApi } from '../api/orders-api';
import { formatDateTime } from '../lib/order-formatters';
import { useOrderDetailWithRefresh } from '../hooks/useOrderDetail';
import {
  updateOrderFormSchema,
  type UpdateOrderFormValues,
} from '../schemas/order.schema';
import type { OrderNote, OrderSummary } from '../types/order.types';

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
  const [formError, setFormError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { order, isLoading, error } = useOrderDetailWithRefresh(orderId, refreshKey);
  const form = useForm<UpdateOrderFormValues>({
    resolver: zodResolver(updateOrderFormSchema),
    defaultValues: {
      customerEmail: '',
      customerPhone: '',
      quantity: '1',
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
      quantity: String(order.quantity),
      note: '',
    });
  }, [form, order]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      const payload = updateOrderFormSchema.parse(values);
      const updatedOrder = await ordersApi.update(orderId, payload);

      onUpdated(updatedOrder);
      setRefreshKey((currentValue) => currentValue + 1);
      form.reset({
        customerEmail: payload.customerEmail ?? '',
        customerPhone: payload.customerPhone ?? '',
        quantity: String(payload.quantity),
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
              Update customer contact details, quantity, and add notes for {order.orderNumber}.
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
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" inputMode="numeric" {...form.register('quantity')} />
          {form.formState.errors.quantity ? (
            <p className="text-sm text-destructive">
              {getFieldErrorMessage(form.formState.errors.quantity.message)}
            </p>
          ) : null}
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
          <Button variant="outline" size="lg" onClick={onCancel}>
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
