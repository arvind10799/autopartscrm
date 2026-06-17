'use client';

import { RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { WorkspacePageSkeleton } from '@/components/feedback/page-skeletons';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CostBreakdownCard } from './CostBreakdownCard';
import { GrossProfitCalculationCard } from './GrossProfitCalculationCard';
import { ShipmentCostForm } from './ShipmentCostForm';
import { formatCostCurrency } from '../lib/cost-formatters';
import { useCostsWorkspace } from '../hooks/useCostsWorkspace';

export function CostsPageContent() {
  const {
    form,
    role,
    canEditCosts,
    shipments,
    selectedShipmentId,
    selectedShipment,
    existingCost,
    currentDraft,
    isShipmentsLoading,
    shipmentsError,
    isContextLoading,
    contextError,
    formError,
    mode,
    isDelivered,
    activeCurrency,
    totalCosts,
    liveGrossProfit,
    retryShipments,
    retryContext,
    handleShipmentChange,
    handleSubmit,
  } = useCostsWorkspace();

  if (isShipmentsLoading) {
    return <WorkspacePageSkeleton />;
  }

  if (shipmentsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Costs workspace unavailable</CardTitle>
          <CardDescription>{shipmentsError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={retryShipments}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (shipments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl sm:text-[1.75rem]">No shipments ready for costs</CardTitle>
          <CardDescription>
            Create or import shipments first, then this workspace can attach purchase and freight costs to them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Shipment cost workspace is waiting for source records"
            description="As soon as shipments are available, this module will let operations teams capture purchase, freight, and additional landed costs."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Selected shipment</CardDescription>
            <CardTitle className="text-2xl sm:text-[1.75rem]">
              {selectedShipment ? (selectedShipment.proNumber ?? 'PRO pending') : '--'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Linked to order {selectedShipment?.order.orderNumber ?? 'pending selection'}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Live total costs</CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
              {formatCostCurrency(totalCosts, activeCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Purchase, shipping, and additional charges combined in real time.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Live GP</CardDescription>
            <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
              {liveGrossProfit === null
                ? 'Pending'
                : formatCostCurrency(liveGrossProfit, activeCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Uses the linked order revenue and the current form values.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ShipmentCostForm
          form={form}
          shipments={shipments}
          selectedShipmentId={selectedShipmentId}
          selectedShipment={selectedShipment}
          mode={mode}
          canEdit={canEditCosts}
          isDelivered={Boolean(isDelivered)}
          isContextLoading={isContextLoading}
          role={role}
          formError={formError}
          lastUpdatedAt={existingCost?.updatedAt ?? null}
          onShipmentChange={handleShipmentChange}
          onSubmit={handleSubmit}
        />

        <div className="grid gap-6">
          <GrossProfitCalculationCard
            currency={activeCurrency}
            revenue={selectedShipment?.order.totalSaleAmount ?? null}
            totalCosts={totalCosts}
            gp={liveGrossProfit}
          />

          <CostBreakdownCard
            currency={activeCurrency}
            purchaseAmount={currentDraft.purchaseAmount}
            shippingCharges={currentDraft.shippingCharges}
            additionalCharges={currentDraft.additionalCharges}
            gp={liveGrossProfit}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl sm:text-[1.75rem]">Shipment context</CardTitle>
              <CardDescription>
                Revenue reference and save state for the currently selected shipment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contextError ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
                  <span>{contextError}</span>
                  <Button type="button" variant="outline" size="sm" onClick={retryContext}>
                    <RefreshCw className="h-4 w-4" />
                    Retry context
                  </Button>
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Order revenue reference
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {selectedShipment
                    ? formatCostCurrency(
                        selectedShipment.order.totalSaleAmount ?? 0,
                        activeCurrency,
                      )
                    : 'Loading order total...'}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Save mode
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {mode === 'update' ? 'Update existing cost' : 'Create new cost'}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  RBAC
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Admin and Shipping can save. Sales can review cost visibility without editing.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
