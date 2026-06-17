import type { ShipmentStatus } from '@/features/shipments/types/shipment.types';

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
  additionalCharges: number;
  gp: number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  shipment: ShipmentCostContext;
}

export interface CreateShipmentCostInput {
  shipmentId: string;
  purchaseAmount: number;
  shippingCharges: number;
  additionalCharges: number;
  currency: string;
}

export interface UpdateShipmentCostInput {
  purchaseAmount: number;
  shippingCharges: number;
  additionalCharges: number;
  currency: string;
}

export interface ShipmentCostDraft {
  purchaseAmount: number;
  shippingCharges: number;
  additionalCharges: number;
}

export type ShipmentCostMode = 'create' | 'update';
