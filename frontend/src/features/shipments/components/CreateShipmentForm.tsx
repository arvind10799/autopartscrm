'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/utils/error';
import type { OrderDetail, OrderSummary } from '@/features/orders/types/order.types';
import { shipmentsApi } from '../api/shipments-api';
import {
  formatShipmentStatusOptionLabel,
  isShipmentStatus,
} from '../lib/shipments.helpers';
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

const DEFAULT_SHIPMENT_STATUS: ShipmentStatus = 'PENDING';

const defaultValues: CreateShipmentFormValues = {
  bolNumber: '',
  pickupNumber: '',
  orderId: '',
  status: DEFAULT_SHIPMENT_STATUS,
  carrierName: '',
  purchaseAmount: '',
  shippingAmount: '',
  additionalAmount: '',
  costNotes: '',
};

export function CreateShipmentForm({
  selectedOrder,
  onCreated,
  onCostDraftChange,
}: {
  selectedOrder: Pick<
    OrderSummary,
    'id' | 'orderNumber' | 'customerName' | 'createdBy'
  > &
    Partial<Pick<OrderDetail, 'shipments'>>;
  onCreated: (shipment: ShipmentSummary) => void;
  onCostDraftChange?: (draft: CreateShipmentCostDraft) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [savedShipmentSnapshot, setSavedShipmentSnapshot] =
    useState<ShipmentSummary | null>(null);
  const currentShipment = selectedOrder.shipments?.[0] ?? null;
  const shipmentForForm = useMemo(
    () =>
      mergeShipmentFormSourceWithSnapshot(
        currentShipment,
        savedShipmentSnapshot,
      ),
    [currentShipment, savedShipmentSnapshot],
  );
  const currentCost = shipmentForForm?.costs?.[0] ?? null;
  const hasSavedPurchaseCost =
    currentCost?.purchaseAmount !== undefined && currentCost.purchaseAmount > 0;
  const form = useForm<CreateShipmentFormValues>({
    resolver: zodResolver(createShipmentSchema),
    defaultValues,
  });
  const selectedStatus = form.watch('status');
  const purchaseAmountValue = form.watch('purchaseAmount');
  const shippingAmountValue = form.watch('shippingAmount');
  const additionalAmountValue = form.watch('additionalAmount');
  const showShippingFields = selectedStatus === 'SHIPPED';
  const showPurchaseCostField =
    selectedStatus === 'PURCHASE' || selectedStatus === 'SHIPPED';
  const showPurchaseCostInput =
    showPurchaseCostField &&
    !(selectedStatus === 'SHIPPED' && hasSavedPurchaseCost);
  const showActualShippingCostField = selectedStatus === 'SHIPPED';

  useEffect(() => {
    form.reset(buildShipmentFormValues(selectedOrder.id, shipmentForForm));
  }, [form, selectedOrder.id, shipmentForForm]);

  useEffect(() => {
    if (showShippingFields) {
      return;
    }

    form.setValue('bolNumber', '');
    form.setValue('pickupNumber', '');
    form.setValue('carrierName', '');
  }, [form, showShippingFields]);

  useEffect(() => {
    if (showActualShippingCostField) {
      return;
    }

    form.setValue('shippingAmount', '');
  }, [form, showActualShippingCostField]);

  useEffect(() => {
    onCostDraftChange?.({
      purchaseAmount:
        parseOptionalAmount(purchaseAmountValue) ??
        (hasSavedPurchaseCost ? currentCost?.purchaseAmount ?? 0 : 0),
      shippingAmount: parseOptionalAmount(shippingAmountValue) ?? 0,
      additionalAmount: parseOptionalAmount(additionalAmountValue) ?? 0,
    });
  }, [
    additionalAmountValue,
    currentCost?.purchaseAmount,
    hasSavedPurchaseCost,
    onCostDraftChange,
    purchaseAmountValue,
    shippingAmountValue,
  ]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);

    try {
      const payload = createShipmentSchema.parse({
        ...values,
        purchaseAmount:
          values.purchaseAmount ||
          (hasSavedPurchaseCost ? currentCost.purchaseAmount : undefined),
        status: values.status ?? 'PENDING',
      });
      const savedShipment = currentShipment
        ? await shipmentsApi.updateStatus(currentShipment.id, payload)
        : await shipmentsApi.create(payload);
      setSavedShipmentSnapshot(savedShipment);
      form.reset(buildShipmentFormValues(selectedOrder.id, savedShipment));
      onCreated(savedShipment);
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
              htmlFor="pickupNumber"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Pickup No. <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="pickupNumber"
              placeholder="PU-2026-001"
              className="h-11 rounded-xl"
              {...form.register('pickupNumber')}
            />
            {form.formState.errors.pickupNumber ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.pickupNumber.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="carrierName"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Freight carrier
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

      {showPurchaseCostInput ? (
        <div className="space-y-2">
          <Label
            htmlFor="purchaseAmount"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            Part purchased cost
          </Label>
          <Input
            id="purchaseAmount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="h-11 rounded-xl"
            {...form.register('purchaseAmount')}
          />
          {form.formState.errors.purchaseAmount ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.purchaseAmount.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Internal GP cost only. This does not change invoice shipping charges.
            </p>
          )}
        </div>
      ) : null}

      {selectedStatus === 'SHIPPED' && hasSavedPurchaseCost ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Part purchased cost saved
          </p>
          <p className="mt-1 font-semibold">
            {currentCost.purchaseAmount.toFixed(2)}
          </p>
        </div>
      ) : null}

      {showActualShippingCostField ? (
        <div className="space-y-2">
          <Label
            htmlFor="shippingAmount"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            Actual shipping cost
          </Label>
          <Input
            id="shippingAmount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className="h-11 rounded-xl"
            {...form.register('shippingAmount')}
          />
          {form.formState.errors.shippingAmount ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.shippingAmount.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Actual freight cost for GP calculation, separate from customer shipping charges.
            </p>
          )}
        </div>
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
        {form.formState.isSubmitting
          ? currentShipment
            ? 'Updating status...'
            : 'Creating shipment...'
          : currentShipment
            ? 'Update status'
            : 'Create shipment'}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}

type ShipmentFormSource = {
  id?: string;
  bolNumber?: string | null;
  pickupNumber?: string | null;
  carrierName?: string | null;
  status?: string;
  currentStatus?: ShipmentStatus;
  costs?: Array<{
    purchaseAmount: number;
    shippingAmount: number;
    additionalAmount: number;
    notes: string | null;
  }>;
} | null;

function mergeShipmentFormSourceWithSnapshot(
  shipment: ShipmentFormSource,
  snapshot: ShipmentSummary | null,
): ShipmentFormSource {
  if (!shipment) {
    return snapshot;
  }

  if (!snapshot || shipment.id !== snapshot.id || shipment.costs?.length) {
    return shipment;
  }

  return {
    ...shipment,
    costs: snapshot.costs,
  };
}

function buildShipmentFormValues(
  orderId: string,
  shipment: ShipmentFormSource,
): CreateShipmentFormValues {
  const cost = shipment?.costs?.[0] ?? null;
  const rawStatus =
    shipment?.currentStatus ?? shipment?.status ?? DEFAULT_SHIPMENT_STATUS;
  const status = isShipmentStatus(rawStatus)
    ? rawStatus
    : DEFAULT_SHIPMENT_STATUS;

  return {
    ...defaultValues,
    orderId,
    status,
    bolNumber: shipment?.bolNumber ?? '',
    pickupNumber: shipment?.pickupNumber ?? '',
    carrierName: shipment?.carrierName ?? '',
    purchaseAmount:
      cost?.purchaseAmount !== undefined ? cost.purchaseAmount.toFixed(2) : '',
    shippingAmount:
      cost?.shippingAmount !== undefined ? cost.shippingAmount.toFixed(2) : '',
    additionalAmount:
      cost?.additionalAmount !== undefined
        ? cost.additionalAmount.toFixed(2)
        : '',
    costNotes: cost?.notes ?? '',
  };
}

export type CreateShipmentCostDraft = {
  purchaseAmount: number;
  shippingAmount: number;
  additionalAmount: number;
};

function parseOptionalAmount(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? Math.max(parsedValue, 0) : undefined;
}
