import { SHIPMENT_STATUSES, type ShipmentStatus } from '@/features/shipments/types/shipment.types';
import {
  REPLACEMENT_STATUSES,
  type ReplacementsListQuery,
  type ReplacementStatus,
} from '../types/replacement.types';

export const REPLACEMENTS_PAGE_SIZE = 20;
export const ALL_REPLACEMENT_STATUS_FILTER = 'ALL';

export type ReplacementStatusFilter =
  | ReplacementStatus
  | typeof ALL_REPLACEMENT_STATUS_FILTER;

export function formatReplacementStatus(status: ReplacementStatus | string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function parseReplacementStatusFilter(value: string): ReplacementStatusFilter {
  return REPLACEMENT_STATUSES.includes(value as ReplacementStatus)
    ? (value as ReplacementStatus)
    : ALL_REPLACEMENT_STATUS_FILTER;
}

export function normalizeReplacementsListQuery(
  query: ReplacementsListQuery,
): ReplacementsListQuery {
  return {
    page: Number.isInteger(query.page) && query.page > 0 ? query.page : 1,
    limit:
      Number.isInteger(query.limit) && query.limit > 0
        ? Math.min(query.limit, 100)
        : REPLACEMENTS_PAGE_SIZE,
    ...(query.search?.trim() ? { search: query.search.trim() } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.shipmentStatus ? { shipmentStatus: query.shipmentStatus } : {}),
    ...(query.orderId ? { orderId: query.orderId } : {}),
    ...(query.shipmentId ? { shipmentId: query.shipmentId } : {}),
    ...(query.createdFrom ? { createdFrom: query.createdFrom } : {}),
    ...(query.createdTo ? { createdTo: query.createdTo } : {}),
  };
}

export function buildReplacementsQueryString(query: ReplacementsListQuery) {
  const params = new URLSearchParams();

  Object.entries(normalizeReplacementsListQuery(query)).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });

  return params.toString();
}

export function parseReplacementsQueryParams(params: URLSearchParams) {
  const page = Number(params.get('page') ?? 1);
  const limit = Number(params.get('limit') ?? REPLACEMENTS_PAGE_SIZE);
  const status = params.get('status') ?? undefined;
  const shipmentStatus = params.get('shipmentStatus') ?? undefined;

  return normalizeReplacementsListQuery({
    page,
    limit,
    search: params.get('search') ?? undefined,
    status: REPLACEMENT_STATUSES.includes(status as ReplacementStatus)
      ? (status as ReplacementStatus)
      : undefined,
    shipmentStatus: SHIPMENT_STATUSES.includes(shipmentStatus as ShipmentStatus)
      ? (shipmentStatus as ShipmentStatus)
      : undefined,
    orderId: params.get('orderId') ?? undefined,
    shipmentId: params.get('shipmentId') ?? undefined,
    createdFrom: params.get('createdFrom') ?? undefined,
    createdTo: params.get('createdTo') ?? undefined,
  });
}

export function createEmptyReplacementsResponse(
  page = 1,
  limit = REPLACEMENTS_PAGE_SIZE,
) {
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
