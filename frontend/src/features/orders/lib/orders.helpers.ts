import { z } from 'zod';
import {
  buildDateRangeSearchParams,
  normalizeTimestampRangeQuery,
  readTimestampRangeQueryFromSearchParams,
} from '@/lib/filters/date-range';
import type {
  CreateOrderInput,
  OrderPaymentMethod,
  OrderShipmentStatus,
  OrderStatus,
  OrdersListQuery,
  OrdersListResponse,
  UpdateOrderInput,
} from '../types/order.types';
import {
  ORDER_PAYMENT_METHODS,
  ORDER_SHIPMENT_STATUSES,
  ORDER_STATUSES,
} from '../types/order.types';

export const ORDER_PAGE_SIZE = 10;
export const ALL_ORDER_STATUS_FILTER = 'ALL' as const;
export const ALL_SHIPMENT_STATUS_FILTER = 'ALL' as const;

export type OrderStatusFilter = typeof ALL_ORDER_STATUS_FILTER | OrderStatus;
export type ShipmentStatusFilter =
  | typeof ALL_SHIPMENT_STATUS_FILTER
  | OrderShipmentStatus;

const orderStatusSchema = z.enum(ORDER_STATUSES);
const shipmentStatusSchema = z.enum(ORDER_SHIPMENT_STATUSES);
const orderPaymentMethodSchema = z.enum(ORDER_PAYMENT_METHODS);
const orderIdSchema = z.string().uuid();
const positiveIntegerSchema = z.coerce.number().int().min(1);
const searchTermSchema = z
  .string()
  .trim()
  .max(160)
  .transform((value) => (value.length > 0 ? value : undefined));

export type NormalizedOrdersQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: OrderStatus;
  shipmentStatus?: OrderShipmentStatus;
  hasShipment?: boolean;
  createdFrom?: string;
  createdTo?: string;
};

export function createEmptyOrdersResponse(
  page = 1,
  limit = ORDER_PAGE_SIZE,
): OrdersListResponse {
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

export function formatOrderStatusOptionLabel(status: OrderStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function formatShipmentStatusOptionLabel(
  status: OrderShipmentStatus,
): string {
  return status
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function formatOrderPaymentMethodLabel(
  paymentMethod: OrderPaymentMethod,
): string {
  return paymentMethod === 'WIRE_TRANSFER' ? 'Wire payment' : 'Credit card payment';
}

export function isOrderStatus(value: string): value is OrderStatus {
  return orderStatusSchema.safeParse(value).success;
}

export function isShipmentStatus(value: string): value is OrderShipmentStatus {
  return shipmentStatusSchema.safeParse(value).success;
}

export function isOrderPaymentMethod(value: string): value is OrderPaymentMethod {
  return orderPaymentMethodSchema.safeParse(value).success;
}

export function parseOrderStatusFilter(value: string): OrderStatusFilter {
  return isOrderStatus(value) ? value : ALL_ORDER_STATUS_FILTER;
}

export function parseShipmentStatusFilter(value: string): ShipmentStatusFilter {
  return isShipmentStatus(value) ? value : ALL_SHIPMENT_STATUS_FILTER;
}

export function isValidOrderId(value: string): boolean {
  return orderIdSchema.safeParse(value).success;
}

export function parseOrdersQueryParams(
  searchParams: URLSearchParams,
): NormalizedOrdersQuery {
  const timestampRange = readTimestampRangeQueryFromSearchParams(searchParams);

  const page = positiveIntegerSchema.catch(1).parse(searchParams.get('page'));
  const limit = positiveIntegerSchema
    .max(100)
    .catch(ORDER_PAGE_SIZE)
    .parse(searchParams.get('limit'));
  const search = searchTermSchema.catch(undefined).parse(searchParams.get('search'));
  const statusValue = searchParams.get('status');
  const shipmentStatusValue = searchParams.get('shipmentStatus');
  const hasShipmentValue = searchParams.get('hasShipment');

  return {
    page,
    limit,
    search,
    status: statusValue && isOrderStatus(statusValue) ? statusValue : undefined,
    shipmentStatus:
      shipmentStatusValue && isShipmentStatus(shipmentStatusValue)
        ? shipmentStatusValue
        : undefined,
    hasShipment:
      hasShipmentValue === 'true'
        ? true
        : hasShipmentValue === 'false'
          ? false
          : undefined,
    createdFrom: timestampRange.createdFrom,
    createdTo: timestampRange.createdTo,
  };
}

export function buildOrdersQueryString(query: NormalizedOrdersQuery): string {
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

  if (query.shipmentStatus) {
    baseSearchParams.set('shipmentStatus', query.shipmentStatus);
  }

  if (query.hasShipment !== undefined) {
    baseSearchParams.set('hasShipment', String(query.hasShipment));
  }

  return buildDateRangeSearchParams(baseSearchParams, query).toString();
}

export function normalizeOrdersListQuery(
  input: OrdersListQuery,
): OrdersListQuery {
  const timestampRange = normalizeTimestampRangeQuery({
    createdFrom: input.createdFrom,
    createdTo: input.createdTo,
  });

  return {
    page: input.page,
    limit: input.limit,
    search: input.search?.trim() || undefined,
    status: input.status,
    shipmentStatus: input.shipmentStatus,
    hasShipment: input.hasShipment,
    createdFrom: timestampRange.createdFrom,
    createdTo: timestampRange.createdTo,
  };
}

export function toBackendCreateOrderPayload(order: CreateOrderInput) {
  return {
    leadId: order.leadId,
    advisorName: order.advisorName,
    orderNumber: order.orderNumber,
    orderDate: order.orderDate,
    customerName: order.customerName,
    partDescription: order.partDescription,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    vehicleMake: order.vehicleMake,
    vehicleModel: order.vehicleModel,
    vehicleYear: order.vehicleYear,
    vehicleVariant: order.vehicleVariant,
    vehicleVin: order.vehicleVin,
    vehicleNotes: order.vehicleNotes,
    vehicleConfiguration: order.vehicleConfiguration,
    billingAddress: order.billingAddress,
    billingPerson: order.billingPerson,
    billingPhone: order.billingPhone,
    shippingAddress: order.shippingAddress,
    shippingPerson: order.shippingPerson,
    shippingPhone: order.shippingPhone,
    shippingAt: order.shippingAt,
    companyName: order.companyName,
    milesOffered: order.milesOffered,
    price: order.salePrice,
    basePrice: order.basePrice,
    salesTax: order.salesTax,
    shippingCharges: order.shippingCharges,
    profit: order.profit,
    total: order.total,
    partialPayment: order.partialPayment,
    quantity: order.quantity,
    status: order.status,
    paymentMethod: order.paymentMethod,
    note: order.note,
  };
}

export function toBackendUpdateOrderPayload(order: UpdateOrderInput) {
  return {
    customerName: order.customerName,
    partDescription: order.partDescription,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    price: order.price,
    total: order.total,
    status: order.status,
    paymentMethod: order.paymentMethod,
    advisorName: order.advisorName,
    orderDate: order.orderDate,
    vehicleMake: order.vehicleMake,
    vehicleModel: order.vehicleModel,
    vehicleYear: order.vehicleYear,
    vehicleVariant: order.vehicleVariant,
    vehicleVin: order.vehicleVin,
    vehicleNotes: order.vehicleNotes,
    vehicleConfiguration: order.vehicleConfiguration,
    billingAddress: order.billingAddress,
    billingPerson: order.billingPerson,
    billingPhone: order.billingPhone,
    shippingAddress: order.shippingAddress,
    shippingPerson: order.shippingPerson,
    shippingPhone: order.shippingPhone,
    shippingAt: order.shippingAt,
    companyName: order.companyName,
    milesOffered: order.milesOffered,
    basePrice: order.basePrice,
    salesTax: order.salesTax,
    shippingCharges: order.shippingCharges,
    profit: order.profit,
    partialPayment: order.partialPayment,
    note: order.note,
  };
}
