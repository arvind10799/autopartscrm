import type { InvoiceRecord } from '@/features/invoices/types/invoice.types';

export const ORDER_STATUSES = [
  'DRAFT',
  'PARTIALLY_PAID',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_SHIPMENT_STATUSES = [
  'PENDING',
  'IN_TRANSIT',
  'DELIVERED',
  'DELAYED',
  'CANCELLED',
] as const;

export type OrderShipmentStatus = (typeof ORDER_SHIPMENT_STATUSES)[number];

export const CREATE_ORDER_STATUSES = [
  'PARTIALLY_PAID',
  'CONFIRMED',
] as const satisfies readonly OrderStatus[];

export const ORDER_PAYMENT_METHODS = ['WIRE_TRANSFER', 'CREDIT_CARD'] as const;

export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];

export interface OrderUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SALES' | 'SHIPPING';
}

export interface OrderIntakeDetails {
  advisorName: string | null;
  orderDate: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  vehicleVariant: string | null;
  vehicleVin: string | null;
  vehicleNotes: string | null;
  vehicleConfiguration: string | null;
  billingAddress: string | null;
  billingPerson: string | null;
  billingPhone: string | null;
  shippingAddress: string | null;
  shippingPerson: string | null;
  shippingPhone: string | null;
  shippingAt: string | null;
  companyName: string | null;
  milesOffered: number | null;
  basePrice: number | null;
  salesTax: number | null;
  shippingCharges: number | null;
  profit: number | null;
  partialPayment: number | null;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  partDescription: string;
  salePrice: number;
  quantity: number;
  totalSaleAmount: number;
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod | null;
  latestShipmentStatus: OrderShipmentStatus | null;
  createdAt: string;
  updatedAt: string;
  customerEmail: string | null;
  customerPhone: string | null;
  createdBy: OrderUser;
  counts: {
    shipments: number;
    notes: number;
  };
  latestNote: OrderNote | null;
}

export interface OrderShipment {
  id: string;
  proNumber: string | null;
  carrierName: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: OrderUser;
}

export interface OrderDetail extends OrderSummary {
  shipments: OrderShipment[];
  notes: OrderNote[];
  intakeDetails: OrderIntakeDetails;
  invoice: InvoiceRecord | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface OrdersListResponse {
  items: OrderSummary[];
  meta: PaginationMeta;
}

export interface OrdersListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: OrderStatus;
  shipmentStatus?: OrderShipmentStatus;
  hasShipment?: boolean;
  createdFrom?: string;
  createdTo?: string;
}

export interface CreateOrderInput {
  leadId?: string;
  advisorName: string;
  orderNumber: string;
  orderDate: string;
  customerName: string;
  partDescription: string;
  customerEmail?: string;
  customerPhone?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleVariant?: string;
  vehicleVin?: string;
  vehicleNotes?: string;
  vehicleConfiguration?: string;
  billingAddress?: string;
  billingPerson?: string;
  billingPhone?: string;
  shippingAddress?: string;
  shippingPerson?: string;
  shippingPhone?: string;
  shippingAt?: string;
  companyName?: string;
  milesOffered?: number;
  salePrice: number;
  basePrice?: number;
  salesTax?: number;
  shippingCharges?: number;
  profit?: number;
  total: number;
  partialPayment?: number;
  quantity: number;
  status: OrderStatus;
  paymentMethod?: OrderPaymentMethod;
  note?: string;
}

export interface NextOrderNumber {
  orderNumber: string;
}

export interface UpdateOrderInput {
  customerName?: string;
  partDescription?: string;
  customerEmail?: string;
  customerPhone?: string;
  quantity?: number;
  price?: number;
  total?: number;
  status?: OrderStatus;
  paymentMethod?: OrderPaymentMethod | null;
  advisorName?: string;
  orderDate?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleVariant?: string;
  vehicleVin?: string;
  vehicleNotes?: string;
  vehicleConfiguration?: string;
  billingAddress?: string;
  billingPerson?: string;
  billingPhone?: string;
  shippingAddress?: string;
  shippingPerson?: string;
  shippingPhone?: string;
  shippingAt?: string;
  companyName?: string;
  milesOffered?: number;
  basePrice?: number;
  salesTax?: number;
  shippingCharges?: number;
  profit?: number;
  partialPayment?: number;
  note?: string;
}
