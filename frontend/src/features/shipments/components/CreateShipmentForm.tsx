'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/utils/error';
import type { OrderSummary } from '@/features/orders/types/order.types';
import { shipmentsApi } from '../api/shipments-api';
import { formatShipmentStatusOptionLabel } from '../lib/shipments.helpers';
import {
  createShipmentSchema,
  type CreateShipmentFormValues,
} from '../schemas/shipment.schema';
import type { ShipmentStatus, ShipmentSummary } from '../types/shipment.types';

const CREATE_SHIPMENT_STATUSES: ShipmentStatus[] = [
  'PENDING',
  'LOCATING',
  'PRE_PROCESSING',
  'PURCHASE',
  'SHIPPED',
];

const defaultValues: CreateShipmentFormValues = {
  bolNumber: '',
  orderId: '',
  status: 'PENDING',
  carrierName: '',
};

export function CreateShipmentForm({
  selectedOrder,
  onCreated,
}: {
  selectedOrder: Pick<
    OrderSummary,
    'id' | 'orderNumber' | 'customerName' | 'createdBy'
  >;
  onCreated: (shipment: ShipmentSummary) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<CreateShipmentFormValues>({
    resolver: zodResolver(createShipmentSchema),
    defaultValues,
  });
  const selectedStatus = form.watch('status');
  const showShippingFields = selectedStatus === 'SHIPPED';

  useEffect(() => {
    form.reset({
      ...defaultValues,
      orderId: selectedOrder.id,
    });
  }, [form, selectedOrder]);

  useEffect(() => {
    if (showShippingFields) {
      return;
    }

    form.setValue('bolNumber', '');
    form.setValue('carrierName', '');
  }, [form, showShippingFields]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      const createdShipment = await shipmentsApi.create({
        ...values,
        status: values.status ?? 'PENDING',
      });
      onCreated(createdShipment);
      form.reset({
        ...defaultValues,
        orderId: selectedOrder.id,
      });
    } catch (error) {
      setFormError(
        getErrorMessage(
          error,
          'Unable to create the shipment right now. Please try again.',
        ),
      );
    }
  });

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <input type="hidden" {...form.register('orderId')} />

      <div className="rounded-[1.5rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(59,130,246,0.10),rgba(255,255,255,0.92))] p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-2.5 text-primary">
            <Truck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Create a new shipment</p>
            <p className="text-sm text-muted-foreground">
              Choose the workflow status now. BOL and freight carrier are captured once it is shipped.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Order
        </Label>
        <div className="rounded-[1.35rem] border border-border/70 bg-secondary/20 px-4 py-4">
          <p className="font-semibold text-foreground">{selectedOrder.orderNumber}</p>
          <p className="text-sm text-muted-foreground">{selectedOrder.customerName}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sales agent: {selectedOrder.createdBy.name}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="shipmentStatus"
          className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        >
          Status
        </Label>
        <Select
          id="shipmentStatus"
          className="h-11 rounded-xl"
          {...form.register('status')}
        >
          {CREATE_SHIPMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatShipmentStatusOptionLabel(status)}
            </option>
          ))}
        </Select>
        {form.formState.errors.status ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.status.message}
          </p>
        ) : null}
      </div>

      {showShippingFields ? (
        <>
          <div className="space-y-2">
            <Label
              htmlFor="bolNumber"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              BOL number
            </Label>
            <Input
              id="bolNumber"
              placeholder="BOL-2026-001"
              className="h-11 rounded-xl"
              {...form.register('bolNumber')}
            />
            {form.formState.errors.bolNumber ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.bolNumber.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="carrierName"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Freight carrier <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="carrierName"
              placeholder="FedEx Freight"
              className="h-11 rounded-xl"
              {...form.register('carrierName')}
            />
            {form.formState.errors.carrierName ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.carrierName.message}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {formError ? (
        <div className="rounded-[1.35rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="h-11 w-full rounded-xl"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? 'Creating shipment...' : 'Create shipment'}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
