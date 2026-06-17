import { z } from 'zod';
import {
  buildDateRangeSearchParams,
  normalizeTimestampRangeQuery,
  readTimestampRangeQueryFromSearchParams,
} from '@/lib/filters/date-range';
import { SHIPMENT_STATUSES } from '../types/shipment.types';
import type {
  ShipmentDetail,
  ShipmentStatus,
  ShipmentSummary,
  ShipmentsListQuery,
  ShipmentsListResponse,
  UpdateShipmentStatusInput,
} from '../types/shipment.types';

export const SHIPMENT_PAGE_SIZE = 10;
export const ALL_SHIPMENT_STATUS_FILTER = 'ALL' as const;

export type ShipmentStatusFilter =
  | typeof ALL_SHIPMENT_STATUS_FILTER
  | ShipmentStatus;

type ShipmentsListQueryInput = {
  page?: unknown;
  limit?: unknown;
  search?: unknown;
  status?: unknown;
  createdFrom?: unknown;
  createdTo?: unknown;
};

type ShipmentPageMetrics = {
  inTransitCount: number;
  delayedCount: number;
};

type ShipmentStatusContext = Pick<ShipmentDetail, 'currentStatus' | 'shippedAt'>;

const shipmentStatusSchema = z.enum(SHIPMENT_STATUSES);
const shipmentIdSchema = z.string().uuid();
const positiveIntegerSchema = z.coerce.number().int().min(1);
const searchTermSchema = z
  .string()
  .trim()
  .max(160)
  .transform((value) => (value.length > 0 ? value : undefined));

const SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELAYED', 'DELIVERED', 'CANCELLED'],
  DELAYED: ['IN_TRANSIT', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function createEmptyShipmentsResponse(
  page = 1,
  limit = SHIPMENT_PAGE_SIZE,
): ShipmentsListResponse {
  return {
    items: [],
    meta: {
      page,
      limit,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

export function formatShipmentStatusOptionLabel(status: ShipmentStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ');
}

export function isShipmentStatus(value: string): value is ShipmentStatus {
  return shipmentStatusSchema.safeParse(value).success;
}

export function parseShipmentStatusFilter(value: string): ShipmentStatusFilter {
  return isShipmentStatus(value) ? value : ALL_SHIPMENT_STATUS_FILTER;
}

export function isValidShipmentId(value: string): boolean {
  return shipmentIdSchema.safeParse(value).success;
}

export function parseShipmentsQueryParams(
  searchParams: URLSearchParams,
): ShipmentsListQuery {
  return normalizeShipmentsListQuery({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    search: searchParams.get('search'),
    status: searchParams.get('status'),
    ...readTimestampRangeQueryFromSearchParams(searchParams),
  });
}

export function normalizeShipmentsListQuery(
  input: ShipmentsListQueryInput,
): ShipmentsListQuery {
  const page = positiveIntegerSchema.catch(1).parse(input.page);
  const limit = positiveIntegerSchema
    .max(100)
    .catch(SHIPMENT_PAGE_SIZE)
    .parse(input.limit ?? SHIPMENT_PAGE_SIZE);
  const search = searchTermSchema.catch(undefined).parse(input.search);
  const timestampRange = normalizeTimestampRangeQuery({
    createdFrom:
      typeof input.createdFrom === 'string' ? input.createdFrom : undefined,
    createdTo: typeof input.createdTo === 'string' ? input.createdTo : undefined,
  });
  const status =
    typeof input.status === 'string' && isShipmentStatus(input.status)
      ? input.status
      : undefined;

  return {
    page,
    limit,
    search,
    status,
    createdFrom: timestampRange.createdFrom,
    createdTo: timestampRange.createdTo,
  };
}

export function buildShipmentsQueryString(query: ShipmentsListQuery): string {
  const baseSearchParams = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });

  if (query.search) {
    baseSearchParams.set('search', query.search);
  }

  if (query.status) {
    baseSearchParams.set('status', query.status);
  }

  return buildDateRangeSearchParams(baseSearchParams, query).toString();
}

export function getAllowedNextShipmentStatuses(
  status: ShipmentStatus,
): ShipmentStatus[] {
  return SHIPMENT_STATUS_TRANSITIONS[status];
}

export function isShipmentStatusTransitionAllowed(
  shipment: ShipmentStatusContext,
  nextStatus: ShipmentStatus,
): boolean {
  if (shipment.currentStatus === nextStatus) {
    return false;
  }

  if (!getAllowedNextShipmentStatuses(shipment.currentStatus).includes(nextStatus)) {
    return false;
  }

  if (nextStatus === 'DELIVERED' && !shipment.shippedAt) {
    return false;
  }

  return true;
}

export function getDefaultNextShipmentStatus(
  status: ShipmentStatus,
): ShipmentStatus | null {
  return getAllowedNextShipmentStatuses(status)[0] ?? null;
}

export function getShipmentPageMetrics(
  shipments: ShipmentSummary[],
): ShipmentPageMetrics {
  return shipments.reduce<ShipmentPageMetrics>(
    (metrics, shipment) => {
      if (shipment.currentStatus === 'IN_TRANSIT') {
        metrics.inTransitCount += 1;
      }

      if (shipment.currentStatus === 'DELAYED') {
        metrics.delayedCount += 1;
      }

      return metrics;
    },
    {
      inTransitCount: 0,
      delayedCount: 0,
    },
  );
}

export function applyOptimisticShipmentStatus(
  shipment: ShipmentDetail,
  nextStatus: ShipmentStatus,
  proNumber?: string,
): ShipmentDetail {
  const now = new Date().toISOString();
  const shippedAt =
    nextStatus === 'IN_TRANSIT' || nextStatus === 'DELIVERED'
      ? shipment.shippedAt ?? now
      : shipment.shippedAt;

  return {
    ...shipment,
    currentStatus: nextStatus,
    proNumber:
      nextStatus === 'IN_TRANSIT' && proNumber ? proNumber : shipment.proNumber,
    updatedAt: now,
    shippedAt,
    deliveredAt: nextStatus === 'DELIVERED' ? now : shipment.deliveredAt,
  };
}

export function mergeShipmentSummaryIntoDetail(
  shipment: ShipmentDetail,
  summary: ShipmentSummary,
): ShipmentDetail {
  return {
    ...shipment,
    ...summary,
  };
}

export function toUpdateShipmentStatusPayload(
  payload: UpdateShipmentStatusInput,
): UpdateShipmentStatusInput {
  return {
    status: payload.status,
    proNumber: payload.proNumber,
  };
}
