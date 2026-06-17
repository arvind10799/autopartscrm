'use client';

import type { UseFormReturn } from 'react-hook-form';
import { ArrowRight, Calculator, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { roleLabels } from '@/features/auth/lib/roles';
import type { UserRole } from '@/features/auth/types/auth.types';
import type { ShipmentSummary } from '@/features/shipments/types/shipment.types';
import type { ShipmentCostMode } from '../types/cost.types';
import type { ShipmentCostFormValues } from '../schemas/cost.schema';
import {
  SUPPORTED_COST_CURRENCIES,
  formatShipmentOptionLabel,
  getShipmentOptionDescription,
} from '../lib/costs.helpers';
import { formatCostDateTime } from '../lib/cost-formatters';

export function ShipmentCostForm({
  form,
  shipments,
  selectedShipmentId,
  selectedShipment,
  mode,
  canEdit,
  isDelivered,
  isContextLoading,
  role,
  formError,
  lastUpdatedAt,
  onShipmentChange,
  onSubmit,
}: {
  form: UseFormReturn<ShipmentCostFormValues>;
  shipments: ShipmentSummary[];
  selectedShipmentId: string;
  selectedShipment: ShipmentSummary | null;
  mode: ShipmentCostMode;
  canEdit: boolean;
  isDelivered: boolean;
  isContextLoading: boolean;
  role: UserRole | null;
  formError: string | null;
  lastUpdatedAt: string | null;
  onShipmentChange: (shipmentId: string) => void;
  onSubmit: ReturnType<UseFormReturn<ShipmentCostFormValues>['handleSubmit']>;
}) {
  const isReadOnly = !canEdit || isDelivered;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-3xl">Shipment cost form</CardTitle>
            <CardDescription>
              Enter purchase, shipping, and additional charges with validation before saving to the backend.
            </CardDescription>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            {mode === 'update'
              ? 'Existing shipment cost loaded for editing.'
              : 'Create a new shipment cost record.'}
          </div>
        </div>

        {selectedShipment ? (
          <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Active shipment
            </p>
            <p className="mt-2 font-semibold text-foreground">
              {formatShipmentOptionLabel(selectedShipment)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {getShipmentOptionDescription(selectedShipment)}
            </p>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="shipmentId">Shipment</Label>
            <Select
              id="shipmentId"
              value={selectedShipmentId}
              onChange={(event) => onShipmentChange(event.target.value)}
              disabled={shipments.length === 0 || isContextLoading}
            >
              <option value="">Select a shipment</option>
              {shipments.map((shipment) => (
                <option key={shipment.id} value={shipment.id}>
                  {formatShipmentOptionLabel(shipment)}
                </option>
              ))}
            </Select>
            {form.formState.errors.shipmentId ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.shipmentId.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchaseAmount">Purchase amount</Label>
              <Input
                id="purchaseAmount"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register('purchaseAmount')}
                disabled={isReadOnly || isContextLoading}
              />
              {form.formState.errors.purchaseAmount ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.purchaseAmount.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="shippingCharges">Shipping charges</Label>
              <Input
                id="shippingCharges"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register('shippingCharges')}
                disabled={isReadOnly || isContextLoading}
              />
              {form.formState.errors.shippingCharges ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.shippingCharges.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_180px]">
            <div className="space-y-2">
              <Label htmlFor="additionalCharges">Additional charges</Label>
              <Input
                id="additionalCharges"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register('additionalCharges')}
                disabled={isReadOnly || isContextLoading}
              />
              {form.formState.errors.additionalCharges ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.additionalCharges.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                id="currency"
                {...form.register('currency')}
                disabled={isReadOnly || isContextLoading}
              >
                {SUPPORTED_COST_CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
              {form.formState.errors.currency ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.currency.message}
                </p>
              ) : null}
            </div>
          </div>

          {role === 'SALES' ? (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              {roleLabels[role]} users can review shipment cost data here, but saving is restricted by backend RBAC.
            </div>
          ) : null}

          {isDelivered ? (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              Delivered shipments are locked from further cost edits by the backend.
            </div>
          ) : null}

          {lastUpdatedAt ? (
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              Last saved {formatCostDateTime(lastUpdatedAt)}
            </div>
          ) : null}

          {formError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={
              form.formState.isSubmitting ||
              isContextLoading ||
              !selectedShipment ||
              isReadOnly
            }
          >
            {form.formState.isSubmitting ? (
              'Saving shipment cost...'
            ) : mode === 'update' ? (
              'Update shipment cost'
            ) : (
              'Save shipment cost'
            )}
            {mode === 'update' ? (
              <Save className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>
        </form>

        <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/15 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary">
              <Calculator className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Real-time GP preview</p>
              <p className="text-sm text-muted-foreground">
                Every amount field updates the calculation cards instantly before the request is sent.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
