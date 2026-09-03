'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, RotateCcw } from 'lucide-react';
import { DetailPageSkeleton } from '@/components/feedback/page-skeletons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/features/auth/store/auth.store';
import {
  formatCurrency,
  formatDateTime,
  formatRelativeTime,
} from '@/features/orders/lib/order-formatters';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/lib/stores/toast.store';
import { useReplacementDetail } from '../hooks/useReplacementDetail';
import { formatReplacementStatus } from '../lib/replacements.helpers';
import { REPLACEMENT_STATUSES, type ReplacementStatus } from '../types/replacement.types';
import { ReplacementStatusBadge } from './ReplacementStatusBadge';

export function ReplacementDetailsView({
  replacementId,
}: {
  replacementId: string;
}) {
  const {
    replacement,
    isLoading,
    error,
    isUpdating,
    updateError,
    updateReplacement,
    clearUpdateError,
  } = useReplacementDetail(replacementId);
  const authUser = useAuthStore((state) => state.user);
  const canManage = authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';
  const [customerReason, setCustomerReason] = useState('');
  const [yardUpdate, setYardUpdate] = useState('');
  const [replacementStatus, setReplacementStatus] =
    useState<ReplacementStatus>('REQUESTED');

  useEffect(() => {
    if (!replacement) {
      return;
    }

    setCustomerReason(replacement.customerReason);
    setYardUpdate(replacement.yardUpdate ?? '');
    setReplacementStatus(replacement.replacementStatus);
  }, [replacement]);

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error || !replacement) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Replacement details</CardTitle>
          <CardDescription>The requested replacement could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive">
            {error ?? 'Replacement details are unavailable.'}
          </div>
          <Link
            href="/replacement-orders"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to replacement orders
          </Link>
        </CardContent>
      </Card>
    );
  }

  const handleUpdate = async () => {
    clearUpdateError();
    await updateReplacement({
      customerReason,
      yardUpdate,
      replacementStatus,
    });
    toast.success('Replacement updated', 'Replacement details and history were saved.');
  };

  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="space-y-4">
          <Link
            href="/replacement-orders"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit px-0')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to replacement orders
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="info" className="w-fit">
                <RotateCcw className="h-3.5 w-3.5" />
                Replacement workflow
              </Badge>
              <CardTitle className="text-3xl">
                {replacement.order.orderNumber}
              </CardTitle>
              <CardDescription>
                {replacement.order.customerName} · {replacement.order.partDescription}
              </CardDescription>
            </div>
            <ReplacementStatusBadge status={replacement.replacementStatus} />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Linked Details</CardTitle>
              <CardDescription>Order and shipment context for this replacement.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Detail label="Order Number" value={replacement.order.orderNumber} />
              <Detail label="Sales Number" value={replacement.order.salesNumber ?? '—'} />
              <Detail label="Customer" value={replacement.order.customerName} />
              <Detail label="Phone" value={replacement.order.customerPhone ?? 'Not provided'} />
              <Detail
                label="Sale Amount"
                value={formatCurrency(
                  replacement.order.totalSaleAmount,
                  replacement.order.currency,
                )}
              />
              <Detail label="Created By" value={replacement.createdBy.name} />
              <Detail label="Part" value={replacement.order.partDescription} wide />
              {replacement.shipment ? (
                <>
                  <Detail
                    label="BOL / Pickup"
                    value={`${replacement.shipment.bolNumber ?? 'BOL pending'} / ${
                      replacement.shipment.pickupNumber ?? 'Pickup pending'
                    }`}
                  />
                  <Detail
                    label="PRO / Carrier"
                    value={`${replacement.shipment.proNumber ?? 'PRO pending'} / ${
                      replacement.shipment.carrierName ?? 'Carrier pending'
                    }`}
                  />
                </>
              ) : null}
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">Update Replacement</CardTitle>
                <CardDescription>
                  Save yard progress and move the replacement through the workflow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  Replacement Status
                  <Select
                    value={replacementStatus}
                    onChange={(event) =>
                      setReplacementStatus(event.target.value as ReplacementStatus)
                    }
                  >
                    {REPLACEMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatReplacementStatus(status)}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  Customer Reason
                  <textarea
                    value={customerReason}
                    onChange={(event) => setCustomerReason(event.target.value)}
                    className="min-h-24 rounded-2xl border border-input bg-background px-3.5 py-3 text-sm font-normal text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  Yard Update
                  <textarea
                    value={yardUpdate}
                    onChange={(event) => setYardUpdate(event.target.value)}
                    className="min-h-24 rounded-2xl border border-input bg-background px-3.5 py-3 text-sm font-normal text-foreground shadow-sm outline-none transition focus:ring-2 focus:ring-ring"
                  />
                </label>

                {updateError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {updateError}
                  </div>
                ) : null}

                <Button disabled={isUpdating} onClick={() => void handleUpdate()}>
                  {isUpdating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  Update Replacement
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Replacement History</CardTitle>
            <CardDescription>
              Every replacement update is timestamped and attributed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {replacement.histories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                No replacement history yet.
              </div>
            ) : (
              replacement.histories.map((history) => (
                <div
                  key={history.id}
                  className="rounded-2xl border border-border/70 bg-secondary/15 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      {history.createdBy.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(history.createdAt)} ·{' '}
                      {formatRelativeTime(history.createdAt)}
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {history.summary}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/70 bg-secondary/15 p-3',
        wide && 'sm:col-span-2',
      )}
    >
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 break-words text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}
