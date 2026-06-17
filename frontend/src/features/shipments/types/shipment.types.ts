import type { OrderStatus } from '@/features/orders/types/order.types';

export const SHIPMENT_STATUSES = [
  'PENDING',
  'IN_TRANSIT',
  'DELIVERED',
  'DELAYED',
  'CANCELLED',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export interface ShipmentOrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  status: OrderStatus;
  totalSaleAmount?: number;
}

export interface ShipmentCounts {
  costs: number;
  events: number;
  notes: number;
}

export interface ShipmentSummary {
  id: string;
  bolNumber: string;
  proNumber: string | null;
  carrierName: string | null;
  currentStatus: ShipmentStatus;
  orderId: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  order: ShipmentOrderSummary;
  counts: ShipmentCounts;
}

export interface ShipmentDetail extends ShipmentSummary {}

export interface ShipmentTimelineEvent {
  id: string;
  eventType: string;
  description: string | null;
  location: string | null;
  eventAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentTimeline {
  shipment: {
    id: string;
    bolNumber: string;
    proNumber: string | null;
    carrierName: string | null;
    currentStatus: ShipmentStatus;
    orderId: string;
  };
  events: ShipmentTimelineEvent[];
}

export const TRACKING_TIMELINE_STATUSES = [
  'CREATED',
  'PICKED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

export type TrackingTimelineStatus =
  (typeof TRACKING_TIMELINE_STATUSES)[number];

export type ShipmentTimelineEntryState = 'completed' | 'current' | 'upcoming';

export interface ShipmentTimelineStatusEntry {
  id: string;
  status: TrackingTimelineStatus;
  label: string;
  description: string;
  location: string | null;
  occurredAt: string | null;
  state: ShipmentTimelineEntryState;
}

export interface ShipmentPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ShipmentsListResponse {
  items: ShipmentSummary[];
  meta: ShipmentPaginationMeta;
}

export interface ShipmentsListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: ShipmentStatus;
  createdFrom?: string;
  createdTo?: string;
}

export interface UpdateShipmentStatusInput {
  status: ShipmentStatus;
  proNumber?: string;
}
