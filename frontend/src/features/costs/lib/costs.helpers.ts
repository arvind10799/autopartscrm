import type { UserRole } from '@/features/auth/types/auth.types';
import { formatShipmentStatus } from '@/features/shipments/lib/shipment-formatters';
import type { ShipmentSummary } from '@/features/shipments/types/shipment.types';
import type {
  CreateShipmentCostInput,
  ShipmentCostDraft,
  ShipmentCostRecord,
  UpdateShipmentCostInput,
} from '../types/cost.types';
import type { ShipmentCostFormValues } from '../schemas/cost.schema';

export const SUPPORTED_COST_CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP'] as const;

export function buildDefaultShipmentCostFormValues(
  shipmentId = '',
): ShipmentCostFormValues {
  return {
    shipmentId,
    purchaseAmount: '',
    shippingCharges: '0.00',
    additionalCharges: '0.00',
    currency: 'USD',
  };
}

export function hydrateShipmentCostFormValues(
  cost: ShipmentCostRecord,
): ShipmentCostFormValues {
  return {
    shipmentId: cost.shipmentId,
    purchaseAmount: cost.purchaseAmount.toFixed(2),
    shippingCharges: cost.shippingCharges.toFixed(2),
    additionalCharges: cost.additionalCharges.toFixed(2),
    currency: cost.currency.toUpperCase(),
  };
}

export function toBackendCreateShipmentCostPayload(
  payload: CreateShipmentCostInput,
) {
  return {
    shipmentId: payload.shipmentId,
    purchaseAmount: payload.purchaseAmount,
    shippingAmount: payload.shippingCharges,
    additionalAmount: payload.additionalCharges,
    currency: payload.currency,
  };
}

export function toBackendUpdateShipmentCostPayload(
  payload: UpdateShipmentCostInput,
) {
  return {
    purchaseAmount: payload.purchaseAmount,
    shippingAmount: payload.shippingCharges,
    additionalAmount: payload.additionalCharges,
    currency: payload.currency,
  };
}

export function parseCurrencyInput(value: string | undefined): string {
  const normalizedValue = value?.trim().toUpperCase();

  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : 'USD';
}

export function parseAmountInput(value: string | undefined): number {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

export function calculateTotalCosts(costDraft: ShipmentCostDraft): number {
  return (
    costDraft.purchaseAmount +
    costDraft.shippingCharges +
    costDraft.additionalCharges
  );
}

export function calculateGrossProfit(
  totalSaleAmount: number | null,
  costDraft: ShipmentCostDraft,
): number | null {
  if (typeof totalSaleAmount !== 'number') {
    return null;
  }

  return totalSaleAmount - calculateTotalCosts(costDraft);
}

export function isCostEditorRole(role: UserRole | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SHIPPING';
}

export function formatShipmentOptionLabel(shipment: ShipmentSummary): string {
  const proNumber = shipment.proNumber ?? 'PRO pending';

  return `${proNumber} - ${shipment.order.orderNumber} - ${shipment.order.customerName}`;
}

export function getShipmentOptionDescription(shipment: ShipmentSummary): string {
  return `BOL ${shipment.bolNumber} | ${formatShipmentStatus(shipment.currentStatus)}`;
}
