import { z } from 'zod';
import { ORDER_STATUSES } from '@/features/orders/types/order.types';
import { SHIPMENT_STATUSES } from '../types/shipment.types';

const orderStatusSchema = z.enum(ORDER_STATUSES);
const shipmentStatusSchema = z.enum(SHIPMENT_STATUSES);
const entityIdSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const optionalAmountInputSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().min(0).optional(),
);

const shipmentOrderSummarySchema = z.object({
  id: entityIdSchema,
  orderNumber: z.string(),
  customerName: z.string(),
  status: orderStatusSchema,
  totalSaleAmount: z.coerce.number().optional(),
  currency: z.string().optional().default('USD'),
  intakeDetails: z
    .object({
      orderDate: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  createdAt: isoDateTimeSchema,
}).transform((order) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  customerName: order.customerName,
  status: order.status,
  totalSaleAmount: order.totalSaleAmount,
  currency: order.currency,
  orderDate: order.intakeDetails?.orderDate ?? null,
  createdAt: order.createdAt,
}));

const shipmentCostSummarySchema = z.object({
  id: entityIdSchema,
  shipmentId: entityIdSchema,
  purchaseAmount: z.coerce.number(),
  shippingAmount: z.coerce.number(),
  additionalAmount: z.coerce.number(),
  grossProfit: z.coerce.number(),
  currency: z.string().optional().default('USD'),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

const shipmentAdditionalCostSummarySchema = z.object({
  id: entityIdSchema,
  shipmentId: entityIdSchema,
  amount: z.coerce.number(),
  reason: z.string(),
  createdAt: isoDateTimeSchema,
  createdBy: z.object({
    id: entityIdSchema,
    name: z.string(),
    email: z.string(),
    role: z.string(),
  }),
});

const shipmentCostHistorySummarySchema = z.object({
  id: entityIdSchema,
  shipmentId: entityIdSchema,
  action: z.string(),
  summary: z.string(),
  changes: z.unknown().nullable(),
  createdAt: isoDateTimeSchema,
  createdBy: z.object({
    id: entityIdSchema,
    name: z.string(),
    email: z.string(),
    role: z.string(),
  }),
});

const shipmentCountsSchema = z.object({
  costs: z.number().int().min(0),
  events: z.number().int().min(0),
  notes: z.number().int().min(0),
});

const shipmentPaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

const shipmentBackendSummarySchema = z.object({
  id: entityIdSchema,
  bolNumber: z.string().nullable(),
  pickupNumber: z.string().nullable().optional(),
  proNumber: z.string().nullable(),
  carrierName: z.string().nullable(),
  status: shipmentStatusSchema,
  orderId: entityIdSchema,
  shippedAt: isoDateTimeSchema.nullable(),
  deliveredAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  order: shipmentOrderSummarySchema,
  costs: z.array(shipmentCostSummarySchema).optional().default([]),
  additionalCosts: z
    .array(shipmentAdditionalCostSummarySchema)
    .optional()
    .default([]),
  costHistories: z
    .array(shipmentCostHistorySummarySchema)
    .optional()
    .default([]),
  _count: shipmentCountsSchema,
});

function normalizeShipmentSummary(
  shipment: z.infer<typeof shipmentBackendSummarySchema>,
) {
  return {
    id: shipment.id,
    bolNumber: shipment.bolNumber,
    pickupNumber: shipment.pickupNumber ?? null,
    proNumber: shipment.proNumber,
    carrierName: shipment.carrierName,
    currentStatus: shipment.status,
    orderId: shipment.orderId,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
    order: shipment.order,
    costs: shipment.costs,
    additionalCosts: shipment.additionalCosts,
    costHistories: shipment.costHistories,
    counts: shipment._count,
  };
}

const shipmentBackendDetailSchema = shipmentBackendSummarySchema.extend({
  events: z.array(z.unknown()).optional(),
  notes: z.array(z.unknown()).optional(),
});

const shipmentTimelineEventSchema = z.object({
  id: entityIdSchema,
  eventType: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  eventAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

const shipmentTimelineShipmentSchema = z
  .object({
    id: entityIdSchema,
    bolNumber: z.string().nullable(),
    pickupNumber: z.string().nullable().optional(),
    proNumber: z.string().nullable(),
    carrierName: z.string().nullable(),
    status: shipmentStatusSchema,
    orderId: entityIdSchema,
  })
  .transform((shipment) => ({
    id: shipment.id,
    bolNumber: shipment.bolNumber,
    pickupNumber: shipment.pickupNumber ?? null,
    proNumber: shipment.proNumber,
    carrierName: shipment.carrierName,
    orderId: shipment.orderId,
    currentStatus: shipment.status,
  }));

export const shipmentSummarySchema = shipmentBackendSummarySchema.transform(
  normalizeShipmentSummary,
);

export const shipmentsListSchema = z
  .object({
    items: z.array(shipmentBackendSummarySchema),
    meta: shipmentPaginationMetaSchema,
  })
  .transform(({ items, meta }) => ({
    items: items.map(normalizeShipmentSummary),
    meta,
  }));

export const shipmentDetailSchema = shipmentBackendDetailSchema.transform(
  normalizeShipmentSummary,
);

export const shipmentTimelineSchema = z.object({
  shipment: shipmentTimelineShipmentSchema,
  events: z.array(shipmentTimelineEventSchema),
});

export const updateShipmentStatusSchema = z.object({
  status: shipmentStatusSchema,
  bolNumber: z
    .string()
    .trim()
    .max(50, 'BOL number must be 50 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  pickupNumber: z
    .string()
    .trim()
    .max(50, 'Pickup No. must be 50 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  proNumber: z
    .string()
    .trim()
    .max(50, 'PRO number must be 50 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  carrierName: z
    .string()
    .trim()
    .max(120, 'Carrier name must be 120 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  purchaseAmount: optionalAmountInputSchema,
  shippingAmount: optionalAmountInputSchema,
  additionalAmount: optionalAmountInputSchema,
  costNotes: z
    .string()
    .trim()
    .max(1000, 'Cost reason must be 1,000 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
}).superRefine((value, context) => {
  if (value.status === 'SHIPPED' && !value.carrierName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Freight carrier is required when shipment status is shipped.',
      path: ['carrierName'],
    });
  }
});

export const createShipmentSchema = z.object({
  bolNumber: z
    .string()
    .trim()
    .max(50, 'BOL number must be 50 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  pickupNumber: z
    .string()
    .trim()
    .max(50, 'Pickup No. must be 50 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  orderId: z
    .string()
    .uuid('Please select a valid order.'),
  status: shipmentStatusSchema.default('PENDING'),
  carrierName: z
    .string()
    .trim()
    .max(120, 'Carrier name must be 120 characters or fewer.')
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  purchaseAmount: optionalAmountInputSchema,
  shippingAmount: optionalAmountInputSchema,
  additionalAmount: optionalAmountInputSchema,
  costNotes: z
    .string()
    .trim()
    .max(1000, 'Cost reason must be 1,000 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
}).superRefine((value, context) => {
  if ((value.status === 'PURCHASE' || value.status === 'SHIPPED') && value.purchaseAmount === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Part purchased cost is required for purchase status.',
      path: ['purchaseAmount'],
    });
  }

  if (value.status === 'SHIPPED' && !value.bolNumber) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'BOL number is required when shipment status is shipped.',
      path: ['bolNumber'],
    });
  }

  if (value.status === 'SHIPPED' && !value.carrierName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Freight carrier is required when shipment status is shipped.',
      path: ['carrierName'],
    });
  }

  if (value.status === 'SHIPPED' && value.shippingAmount === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Actual shipping cost is required when shipment status is shipped.',
      path: ['shippingAmount'],
    });
  }

  if ((value.additionalAmount ?? 0) > 0 && !value.costNotes) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Additional cost reason is required.',
      path: ['costNotes'],
    });
  }
});

export type CreateShipmentFormValues = z.input<typeof createShipmentSchema>;
export type CreateShipmentPayload = z.output<typeof createShipmentSchema>;
