import type { ShipmentStatus } from '@/features/shipments/types/shipment.types';
import type { UserRole } from '@/features/auth/types/auth.types';

export interface ShipmentCostContext {
  id: string;
  proNumber: string | null;
  currentStatus: ShipmentStatus;
  orderId: string;
  order: {
    id: string;
    orderNumber: string;
    totalSaleAmount: number;
  };
}

export interface ShipmentCostRecord {
  id: string;
  shipmentId: string;
  purchaseAmount: number;
  shippingCharges: number;
  estimatedPurchaseAmount: number;
  estimatedShippingCharges: number;
  hasActualPurchaseAmount: boolean;
  hasActualShippingAmount: boolean;
  additionalCharges: number;
  gp: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  shipment: ShipmentCostContext;
}

export interface ShipmentAdditionalCostRecord {
  id: string;
  shipmentId: string;
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

export interface CreateShipmentAdditionalCostInput {
  amount: number;
  reason: string;
}

export interface UpdateShipmentAdditionalCostInput {
  amount: number;
  reason: string;
}

export interface CreateShipmentCostInput {
  shipmentId: string;
  purchaseAmount: number;
  shippingCharges: number;
  estimatedPurchaseAmount?: number;
  estimatedShippingCharges?: number;
  additionalCharges: number;
  currency: string;
}

export interface UpdateShipmentCostInput {
  purchaseAmount?: number;
  shippingCharges?: number;
  estimatedPurchaseAmount?: number;
  estimatedShippingCharges?: number;
  additionalCharges?: number;
  currency?: string;
  notes?: string;
}

export interface ShipmentCostDraft {
  purchaseAmount: number;
  shippingCharges: number;
  estimatedPurchaseAmount: number;
  estimatedShippingCharges: number;
  hasActualPurchaseAmount: boolean;
  hasActualShippingAmount: boolean;
  additionalCharges: number;
}

export type ShipmentCostMode = 'create' | 'update';
