import type { OrderStatus } from '@/features/orders/types/order.types';
import type { ShipmentStatus } from '@/features/shipments/types/shipment.types';

export const REPLACEMENT_STATUSES = [
  'YARD_CONTACTED',
  'WAITING_YARD_RESPONSE',
  'APPROVED',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
] as const;

export type ReplacementStatus = (typeof REPLACEMENT_STATUSES)[number];

export interface ReplacementUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SALES' | 'SHIPPING';
}

export interface ReplacementOrderSummary {
  id: string;
  orderNumber: string;
  salesNumber: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  partDescription: string;
  totalSaleAmount: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
  intakeDetails?: unknown;
}

export interface ReplacementShipmentSummary {
  id: string;
  bolNumber: string | null;
  pickupNumber: string | null;
  proNumber: string | null;
  carrierName: string | null;
  status: ShipmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReplacementHistory {
  id: string;
  replacementRequestId: string;
  action: string;
  summary: string;
  previousStatus: ReplacementStatus | null;
  nextStatus: ReplacementStatus | null;
  customerReason: string | null;
  yardUpdate: string | null;
  replacementProNumber: string | null;
  replacementCarrierName: string | null;
  createdAt: string;
  createdBy: ReplacementUser;
}

export interface ReplacementRequest {
  id: string;
  orderId: string;
  shipmentId: string | null;
  customerReason: string;
  yardUpdate: string | null;
  replacementStatus: ReplacementStatus;
  replacementProNumber: string | null;
  replacementCarrierName: string | null;
  createdAt: string;
  updatedAt: string;
  order: ReplacementOrderSummary;
  shipment: ReplacementShipmentSummary | null;
  createdBy: ReplacementUser;
  updatedBy: ReplacementUser | null;
  histories: ReplacementHistory[];
}

export interface ReplacementPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ReplacementsListResponse {
  items: ReplacementRequest[];
  meta: ReplacementPaginationMeta;
}

export interface ReplacementsListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: ReplacementStatus;
  shipmentStatus?: ShipmentStatus;
  orderId?: string;
  shipmentId?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface CreateReplacementInput {
  orderId: string;
  shipmentId?: string;
  customerReason: string;
  yardUpdate?: string;
  replacementStatus?: ReplacementStatus;
  replacementProNumber?: string;
  replacementCarrierName?: string;
}

export interface UpdateReplacementInput {
  customerReason?: string;
  yardUpdate?: string;
  replacementStatus?: ReplacementStatus;
  replacementProNumber?: string;
  replacementCarrierName?: string;
}
