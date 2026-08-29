'use client';

import { useState } from 'react';
import { Ban, LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { toast } from '@/lib/stores/toast.store';
import { cn } from '@/lib/utils/cn';
import { ordersApi } from '../api/orders-api';
import {
  formatCurrency,
  formatDateTime,
} from '../lib/order-formatters';
import type { OrderDetail, OrderRefundType } from '../types/order.types';

type ResolutionOrder = Pick<
  OrderDetail,
  'id' | 'orderNumber' | 'status' | 'currency' | 'totalSaleAmount' | 'intakeDetails'
>;

type OrderResolutionActionsProps = {
  order: ResolutionOrder;
  onResolved: () => void | Promise<void>;
  className?: string;
};

export function OrderResolutionActions({
  order,
  onResolved,
  className,
}: OrderResolutionActionsProps) {
  const authUser = useAuthStore((state) => state.user);
  const [activeAction, setActiveAction] = useState<'cancel' | 'refund' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [refundType, setRefundType] = useState<OrderRefundType>('FULL');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [deductionReason, setDeductionReason] = useState('');

  const canUseActions = authUser?.role === 'ADMIN' || authUser?.role === 'SHIPPING';
  const canCancel = canUseActions && order.status !== 'CANCELLED' && order.status !== 'REFUNDED';
  const canRefund = canUseActions && order.status !== 'REFUNDED';

  if (authUser?.role !== 'ADMIN' && authUser?.role !== 'SHIPPING') {
    return null;
  }

  const resetModal = () => {
    setActiveAction(null);
    setErrorMessage(null);
    setCancellationReason('');
    setRefundType('FULL');
    setDeductionAmount('');
    setDeductionReason('');
  };

  const handleCancelSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await ordersApi.cancel(order.id, { cancellationReason });
      toast.success(
        `Order ${order.orderNumber} cancelled`,
        'Cancellation reason was saved in the order history.',
      );
      resetModal();
      await onResolved();
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to cancel this order right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefundSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await ordersApi.refund(order.id, {
        refundType,
        refundDeductionAmount:
          refundType === 'PARTIAL' ? Number(deductionAmount) : undefined,
        refundDeductionReason:
          refundType === 'PARTIAL' ? deductionReason : undefined,
      });
      toast.success(
        `Order ${order.orderNumber} refunded`,
        'Refund details were saved and GP was adjusted.',
      );
      resetModal();
      await onResolved();
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to refund this order right now.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={cn('flex flex-wrap gap-2', className)}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canCancel || isSubmitting}
          onClick={() => setActiveAction('cancel')}
        >
          <Ban className="h-4 w-4" />
          Cancellation
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canRefund || isSubmitting}
          onClick={() => setActiveAction('refund')}
        >
          <RotateCcw className="h-4 w-4" />
          Refund
        </Button>
      </div>

      {activeAction ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[1.5rem] border border-border/70 bg-background shadow-2xl">
            <div className="border-b border-border/70 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {order.orderNumber}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                {activeAction === 'cancel' ? 'Cancel order' : 'Refund order'}
              </h2>
            </div>

            <div className="space-y-4 px-5 py-4">
              {activeAction === 'cancel' ? (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    Cancellation Reason
                  </span>
                  <textarea
                    value={cancellationReason}
                    rows={4}
                    onChange={(event) => setCancellationReason(event.target.value)}
                    className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Explain why this order is being cancelled."
                  />
                </label>
              ) : (
                <>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      Refund type
                    </span>
                    <Select
                      value={refundType}
                      onChange={(event) =>
                        setRefundType(event.target.value as OrderRefundType)
                      }
                    >
                      <option value="FULL">Full Refund</option>
                      <option value="PARTIAL">Partial Refund</option>
                    </Select>
                  </label>

                  {refundType === 'FULL' ? (
                    <p className="rounded-2xl border border-border/70 bg-secondary/20 p-3 text-sm text-muted-foreground">
                      Full refund returns the complete order amount and sets GP to
                      $0.00.
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      <label className="grid gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          Deduction Amount/Charges
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={deductionAmount}
                          onChange={(event) => setDeductionAmount(event.target.value)}
                          placeholder="0.00"
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          Reason for Deduction
                        </span>
                        <textarea
                          value={deductionReason}
                          rows={3}
                          onChange={(event) => setDeductionReason(event.target.value)}
                          className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          placeholder="Explain the deduction kept from the refund."
                        />
                      </label>
                    </div>
                  )}
                </>
              )}

              {errorMessage ? (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {errorMessage}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={resetModal}
                disabled={isSubmitting}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() =>
                  activeAction === 'cancel'
                    ? void handleCancelSubmit()
                    : void handleRefundSubmit()
                }
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : activeAction === 'cancel' ? (
                  'Save cancellation'
                ) : (
                  'Save refund'
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function OrderResolutionDetails({
  order,
  className,
}: {
  order: ResolutionOrder;
  className?: string;
}) {
  const details = order.intakeDetails;
  const isCancelled = order.status === 'CANCELLED' || Boolean(details.cancellationReason);
  const isRefunded = order.status === 'REFUNDED' || Boolean(details.refundType);

  if (!isCancelled && !isRefunded) {
    return null;
  }

  return (
    <div className={cn('rounded-2xl border border-border/70 bg-secondary/15 p-3', className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Resolution details
      </p>
      <div className="mt-2 grid gap-2 text-sm text-foreground">
        {isCancelled ? (
          <div className="rounded-xl border border-border/60 bg-background/80 p-3">
            <p className="font-semibold">Cancellation Reason</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
              {details.cancellationReason ?? 'Not provided'}
            </p>
            {details.cancelledAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Cancelled {formatDateTime(details.cancelledAt)}
              </p>
            ) : null}
          </div>
        ) : null}

        {isRefunded ? (
          <div className="rounded-xl border border-border/60 bg-background/80 p-3">
            <p className="font-semibold">
              Refund: {details.refundType === 'PARTIAL' ? 'Partial Refund' : 'Full Refund'}
            </p>
            {details.refundType === 'PARTIAL' ? (
              <>
                <p className="mt-1 text-muted-foreground">
                  Refunded amount:{' '}
                  {formatCurrency(
                    details.refundDeductionAmount ?? 0,
                    order.currency,
                  )}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  Refund reason: {details.refundDeductionReason ?? 'Not provided'}
                </p>
              </>
            ) : (
              <p className="mt-1 text-muted-foreground">
                Complete order amount refunded. GP is $0.00.
              </p>
            )}
            {details.refundedAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Refunded {formatDateTime(details.refundedAt)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
