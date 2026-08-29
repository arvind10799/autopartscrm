import type { OrderDetail } from '../types/order.types';

type OrderFinancialInput = Pick<
  OrderDetail,
  'status' | 'totalSaleAmount' | 'paymentMethod' | 'intakeDetails'
>;

export type OrderFinancialSummary = {
  originalPaidAmount: number;
  refundedAmount: number;
  retainedPaidAmount: number;
  remainingAmount: number;
  gpSaleBasis: number;
  grossProfitOverride?: number;
};

function clampCurrencyAmount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(value, 0);
}

export function getOriginalPaidAmount(order: OrderFinancialInput): number {
  const partialPayment = clampCurrencyAmount(order.intakeDetails.partialPayment ?? 0);

  if (partialPayment > 0) {
    return Math.min(partialPayment, order.totalSaleAmount);
  }

  if (
    order.paymentMethod ||
    ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].includes(
      order.status,
    )
  ) {
    return order.totalSaleAmount;
  }

  return 0;
}

export function getRefundedAmount(order: OrderFinancialInput): number {
  if (order.status !== 'REFUNDED') {
    return 0;
  }

  const originalPaidAmount = getOriginalPaidAmount(order);

  if (order.intakeDetails.refundType === 'PARTIAL') {
    return Math.min(
      clampCurrencyAmount(order.intakeDetails.refundDeductionAmount ?? 0),
      originalPaidAmount,
    );
  }

  return originalPaidAmount;
}

export function getOrderFinancialSummary(
  order: OrderFinancialInput,
): OrderFinancialSummary {
  const originalPaidAmount = getOriginalPaidAmount(order);
  const refundedAmount = getRefundedAmount(order);
  const retainedPaidAmount = Math.max(originalPaidAmount - refundedAmount, 0);
  const isResolvedOrder = order.status === 'CANCELLED' || order.status === 'REFUNDED';
  const remainingAmount = isResolvedOrder
    ? 0
    : Math.max(order.totalSaleAmount - originalPaidAmount, 0);
  const gpSaleBasis =
    order.status === 'REFUNDED'
      ? Math.max(order.totalSaleAmount - refundedAmount, 0)
      : order.totalSaleAmount;

  return {
    originalPaidAmount,
    refundedAmount,
    retainedPaidAmount,
    remainingAmount,
    gpSaleBasis,
    grossProfitOverride:
      order.status === 'REFUNDED' && order.intakeDetails.refundType !== 'PARTIAL'
        ? 0
        : undefined,
  };
}
