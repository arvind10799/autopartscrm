'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, History } from 'lucide-react';
import { DetailPageSkeleton } from '@/components/feedback/page-skeletons';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { ShipmentStatusBadge } from '@/features/shipments/components/ShipmentStatusBadge';
import { useOrderDetail } from '../hooks/useOrderDetail';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatOrderPaymentMethod,
} from '../lib/order-formatters';
import type { OrderNote, OrderShipmentStatus } from '../types/order.types';

export function OrderDetailsView({ orderId }: { orderId: string }) {
  const { order, isLoading, error } = useOrderDetail(orderId);

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !order) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Order details</CardTitle>
          <CardDescription>
            The requested order could not be loaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {error ?? 'Order details are unavailable.'}
          </div>
          <Link
            href="/orders"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Link>
        </CardContent>
      </Card>
    );
  }

  const intake = order.intakeDetails;

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="space-y-4">
          <Link
            href="/orders"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit px-0')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to orders
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="break-words text-3xl sm:text-[2rem]">
                  {order.orderNumber}
                </CardTitle>
                <ShippingStatusValue
                  shipmentCount={order.counts.shipments}
                  status={order.latestShipmentStatus}
                />
              </div>
              <CardDescription>
                {order.customerName} ordered {order.partDescription}.
              </CardDescription>
            </div>

            <div className="rounded-2xl border border-border/70 bg-secondary/35 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Total
              </p>
              <p className="mt-2 font-[var(--font-heading)] text-2xl font-semibold tabular-nums text-foreground sm:text-[1.75rem]">
                {formatCurrency(order.totalSaleAmount)}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Order details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <DetailSection title="Basic Order Info">
            <DetailBlock label="Order number" value={order.orderNumber} />
            <DetailBlock
              label="Date"
              value={intake.orderDate ? formatDate(intake.orderDate) : 'Not provided'}
            />
          </DetailSection>

          <DetailSection title="Customer Info">
            <DetailBlock label="Name" value={order.customerName} />
            <DetailBlock label="Mobile" value={order.customerPhone ?? 'Not provided'} />
            <DetailBlock label="Email" value={order.customerEmail ?? 'Not provided'} />
          </DetailSection>

          <DetailSection title="Vehicle / Part Info">
            <DetailBlock label="Parts" value={order.partDescription} />
            <DetailBlock label="Make" value={intake.vehicleMake ?? 'Not provided'} />
            <DetailBlock label="Model" value={intake.vehicleModel ?? 'Not provided'} />
            <DetailBlock label="Year" value={intake.vehicleYear ?? 'Not provided'} />
            <DetailBlock label="Variant" value={intake.vehicleVariant ?? 'Not provided'} />
            <DetailBlock label="VIN" value={intake.vehicleVin ?? 'Not provided'} />
            <DetailBlock
              label="Notes"
              value={intake.vehicleNotes ?? 'Not provided'}
            />
            <DetailBlock
              label="Configuration"
              value={intake.vehicleConfiguration ?? 'Not provided'}
            />
          </DetailSection>

          <DetailSection title="Billing Information">
            <DetailBlock
              label="Billing Address"
              value={intake.billingAddress ?? 'Not provided'}
            />
            <DetailBlock
              label="Billing Person"
              value={intake.billingPerson ?? 'Not provided'}
            />
            <DetailBlock
              label="Billing Phone"
              value={intake.billingPhone ?? 'Not provided'}
            />
          </DetailSection>

          <DetailSection title="Shipping Information">
            <DetailBlock
              label="Shipping Address"
              value={intake.shippingAddress ?? 'Not provided'}
            />
            <DetailBlock
              label="Shipping Person"
              value={intake.shippingPerson ?? 'Not provided'}
            />
            <DetailBlock
              label="Shipping Phone"
              value={intake.shippingPhone ?? 'Not provided'}
            />
            <DetailBlock
              label="Shipping Date"
              value={intake.shippingAt ? formatDate(intake.shippingAt) : 'Not provided'}
            />
            <DetailBlock
              label="Company Name"
              value={intake.companyName ?? 'Not provided'}
            />
            <DetailBlock
              label="Shipping status"
              value={
                <ShippingStatusValue
                  shipmentCount={order.counts.shipments}
                  status={order.latestShipmentStatus}
                />
              }
            />
          </DetailSection>

          <DetailSection title="Pricing / Sales Info">
            <DetailBlock
              label="Miles Offered"
              value={formatNullableNumber(intake.milesOffered)}
            />
            <DetailBlock
              label="Price Offered"
              value={formatCurrency(order.salePrice)}
            />
            <DetailBlock
              label="Base Price"
              value={formatNullableCurrency(intake.basePrice)}
            />
            <DetailBlock
              label="Sales Tax"
              value={formatNullableCurrency(intake.salesTax)}
            />
            <DetailBlock
              label="Shipping Charges"
              value={formatNullableCurrency(intake.shippingCharges)}
            />
            <DetailBlock
              label="Profit"
              value={formatNullableCurrency(intake.profit)}
            />
            <DetailBlock label="Total" value={formatCurrency(order.totalSaleAmount)} />
            <DetailBlock
              label="Partial Payment"
              value={formatNullableCurrency(intake.partialPayment)}
            />
            <DetailBlock
              label="Payment method"
              value={
                order.paymentMethod
                  ? formatOrderPaymentMethod(order.paymentMethod)
                  : 'Not required'
              }
            />
          </DetailSection>

          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold text-foreground">Latest shipment</h3>
              <p className="text-sm text-muted-foreground">
                Surface the most recent shipment without leaving the order page.
              </p>
            </div>

            {order.shipments.length > 0 ? (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-secondary/20 p-4">
                <p className="font-semibold text-foreground">
                  {order.shipments[0].proNumber ?? 'PRO pending'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.shipments[0].carrierName ?? 'Carrier pending'} |{' '}
                  {order.shipments[0].status}
                </p>
                <p className="text-sm text-muted-foreground">
                  Updated {formatDateTime(order.shipments[0].updatedAt)}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                Shipment is not created yet.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold text-foreground">Notes and edit history</h3>
              <p className="text-sm text-muted-foreground">
                View notes added during order creation and previous update history.
              </p>
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
        </CardContent>
      </Card>
    </section>
  );
}

function isHistoryNote(note: OrderNote): boolean {
  return note.content.startsWith('Order updated:');
}

function formatNullableCurrency(value: number | null): string {
  return value === null ? 'Not provided' : formatCurrency(value);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'Not provided' : String(value);
}

function ShippingStatusValue({
  status,
  shipmentCount,
}: {
  status: OrderShipmentStatus | null;
  shipmentCount: number;
}) {
  if (!status || shipmentCount === 0) {
    return <span className="text-sm text-muted-foreground">Shipment is not created yet</span>;
  }

  return <ShipmentStatusBadge status={status} />;
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-2xl font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function DetailBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 text-sm text-foreground whitespace-pre-wrap">{value}</div>
    </div>
  );
}
