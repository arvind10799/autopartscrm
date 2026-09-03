import { z } from 'zod';
import { ORDER_STATUSES } from '@/features/orders/types/order.types';
import { SHIPMENT_STATUSES } from '@/features/shipments/types/shipment.types';
import { REPLACEMENT_STATUSES } from '../types/replacement.types';

const replacementStatusSchema = z.enum(REPLACEMENT_STATUSES);
const orderStatusSchema = z.enum(ORDER_STATUSES);
const shipmentStatusSchema = z.enum(SHIPMENT_STATUSES);
const entityIdSchema = z.string().uuid();
const isoDateTimeSchema = z.string();
const userRoleSchema = z.enum(['ADMIN', 'SALES', 'SHIPPING']);

const replacementUserSchema = z.object({
  id: entityIdSchema,
  name: z.string(),
  email: z.string(),
  role: userRoleSchema,
});

const replacementOrderSchema = z.object({
  id: entityIdSchema,
  orderNumber: z.string(),
  salesNumber: z.string().nullable().optional(),
  customerName: z.string(),
  customerPhone: z.string().nullable(),
  customerEmail: z.string().nullable(),
  partDescription: z.string(),
  totalSaleAmount: z.coerce.number(),
  currency: z.string().optional().default('USD'),
  status: orderStatusSchema,
  createdAt: isoDateTimeSchema,
  intakeDetails: z.unknown().optional(),
}).transform((order) => ({
  ...order,
  salesNumber: order.salesNumber ?? null,
}));

const replacementShipmentSchema = z.object({
  id: entityIdSchema,
  bolNumber: z.string().nullable(),
  pickupNumber: z.string().nullable().optional(),
  proNumber: z.string().nullable(),
  carrierName: z.string().nullable(),
  status: shipmentStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}).transform((shipment) => ({
  ...shipment,
  pickupNumber: shipment.pickupNumber ?? null,
}));

const replacementHistorySchema = z.object({
  id: entityIdSchema,
  replacementRequestId: entityIdSchema,
  action: z.string(),
  summary: z.string(),
  previousStatus: replacementStatusSchema.nullable(),
  nextStatus: replacementStatusSchema.nullable(),
  customerReason: z.string().nullable(),
  yardUpdate: z.string().nullable(),
  replacementProNumber: z.string().nullable().optional(),
  replacementCarrierName: z.string().nullable().optional(),
  createdAt: isoDateTimeSchema,
  createdBy: replacementUserSchema,
}).transform((history) => ({
  ...history,
  replacementProNumber: history.replacementProNumber ?? null,
  replacementCarrierName: history.replacementCarrierName ?? null,
}));

export const replacementRequestSchema = z.object({
  id: entityIdSchema,
  orderId: entityIdSchema,
  shipmentId: entityIdSchema.nullable(),
  customerReason: z.string(),
  yardUpdate: z.string().nullable(),
  replacementStatus: replacementStatusSchema,
  replacementProNumber: z.string().nullable().optional(),
  replacementCarrierName: z.string().nullable().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  order: replacementOrderSchema,
  shipment: replacementShipmentSchema.nullable(),
  createdBy: replacementUserSchema,
  updatedBy: replacementUserSchema.nullable(),
  histories: z.array(replacementHistorySchema).optional().default([]),
}).transform((replacement) => ({
  ...replacement,
  replacementProNumber: replacement.replacementProNumber ?? null,
  replacementCarrierName: replacement.replacementCarrierName ?? null,
}));

export const replacementsListSchema = z.object({
  items: z.array(replacementRequestSchema),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});

export const createReplacementSchema = z.object({
  orderId: entityIdSchema,
  shipmentId: entityIdSchema.optional(),
  customerReason: z
    .string()
    .trim()
    .min(1, 'Customer reason is required.')
    .max(2000, 'Customer reason must be 2000 characters or fewer.'),
  yardUpdate: z
    .string()
    .trim()
    .max(3000, 'Yard update must be 3000 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  replacementStatus: replacementStatusSchema.optional(),
  replacementProNumber: z
    .string()
    .trim()
    .max(50, 'PRO number must be 50 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  replacementCarrierName: z
    .string()
    .trim()
    .max(120, 'Freight carrier must be 120 characters or fewer.')
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
}).superRefine((value, context) => {
  if (value.replacementStatus !== 'IN_TRANSIT') {
    return;
  }

  if (!value.replacementCarrierName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Freight carrier is required when replacement status is in transit.',
      path: ['replacementCarrierName'],
    });
  }

  if (!value.replacementProNumber) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'PRO number is required when replacement status is in transit.',
      path: ['replacementProNumber'],
    });
  }
});

export const updateReplacementSchema = z.object({
  customerReason: z
    .string()
    .trim()
    .max(2000, 'Customer reason must be 2000 characters or fewer.')
    .optional(),
  yardUpdate: z
    .string()
    .trim()
    .max(3000, 'Yard update must be 3000 characters or fewer.')
    .optional(),
  replacementStatus: replacementStatusSchema.optional(),
  replacementProNumber: z
    .string()
    .trim()
    .max(50, 'PRO number must be 50 characters or fewer.')
    .optional(),
  replacementCarrierName: z
    .string()
    .trim()
    .max(120, 'Freight carrier must be 120 characters or fewer.')
    .optional(),
}).superRefine((value, context) => {
  if (value.replacementStatus !== 'IN_TRANSIT') {
    return;
  }

  if (!value.replacementCarrierName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Freight carrier is required when replacement status is in transit.',
      path: ['replacementCarrierName'],
    });
  }

  if (!value.replacementProNumber) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'PRO number is required when replacement status is in transit.',
      path: ['replacementProNumber'],
    });
  }
});
