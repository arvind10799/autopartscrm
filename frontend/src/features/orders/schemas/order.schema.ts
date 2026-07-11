import { z } from 'zod';
import { invoiceRecordSchema } from '@/features/invoices/schemas/invoice.schema';
import {
  ORDER_PAYMENT_METHODS,
  ORDER_SHIPMENT_STATUSES,
  ORDER_STATUSES,
} from '../types/order.types';

const userRoleSchema = z.enum(['ADMIN', 'SALES', 'SHIPPING']);
const orderStatusSchema = z.enum(ORDER_STATUSES);
const orderPaymentMethodSchema = z.enum(ORDER_PAYMENT_METHODS);
const orderShipmentStatusSchema = z.enum(ORDER_SHIPMENT_STATUSES);
const numericAmountSchema = z.coerce.number().finite();
const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z
    .string()
    .email('Enter a valid email address.')
    .max(160, 'Customer email must be 160 characters or fewer.')
    .optional(),
);
const optionalPhoneSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z
    .string()
    .max(30, 'Customer phone must be 30 characters or fewer.')
    .optional(),
);

function createOptionalTextSchema(maxLength: number, message: string) {
  return z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(maxLength, message).optional(),
  );
}

const optionalNumericValueSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    return value;
  },
  z.coerce
    .number()
    .min(0, 'Value must be 0 or greater.')
    .refine(
      (value) => Number.isInteger(value * 100),
      'Value can include at most 2 decimal places.',
    )
    .optional(),
);

const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

const orderUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
});

const orderNoteSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: orderUserSchema,
});

const orderShipmentSchema = z.object({
  id: z.string(),
  proNumber: z.string().nullable(),
  carrierName: z.string().nullable(),
  status: orderShipmentStatusSchema,
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const orderIntakeDetailsSchema = z.object({
  advisorName: z.string().nullable().optional(),
  orderDate: z.string().nullable().optional(),
  vehicleMake: z.string().nullable().optional(),
  vehicleModel: z.string().nullable().optional(),
  vehicleYear: z.string().nullable().optional(),
  vehicleVariant: z.string().nullable().optional(),
  vehicleVin: z.string().nullable().optional(),
  vehicleNotes: z.string().nullable().optional(),
  vehicleConfiguration: z.string().nullable().optional(),
  billingAddress: z.string().nullable().optional(),
  billingPerson: z.string().nullable().optional(),
  billingPhone: z.string().nullable().optional(),
  shippingAddress: z.string().nullable().optional(),
  shippingPerson: z.string().nullable().optional(),
  shippingPhone: z.string().nullable().optional(),
  shippingAt: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  milesOffered: numericAmountSchema.nullable().optional(),
  basePrice: numericAmountSchema.nullable().optional(),
  salesTax: numericAmountSchema.nullable().optional(),
  shippingCharges: numericAmountSchema.nullable().optional(),
  profit: numericAmountSchema.nullable().optional(),
  partialPayment: numericAmountSchema.nullable().optional(),
});

const orderBackendSummarySchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  customerName: z.string(),
  partDescription: z.string(),
  customerEmail: z.string().email().nullable(),
  customerPhone: z.string().nullable(),
  price: numericAmountSchema,
  quantity: z.number(),
  totalSaleAmount: numericAmountSchema,
  status: orderStatusSchema,
  paymentMethod: orderPaymentMethodSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: orderUserSchema,
  shipments: z
    .array(
      z.object({
        id: z.string(),
        status: orderShipmentStatusSchema,
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    )
    .max(1)
    .optional()
    .default([]),
  _count: z.object({
    shipments: z.number(),
    notes: z.number(),
  }),
  notes: z
    .array(orderNoteSchema)
    .max(1)
    .optional()
    .default([]),
});

function normalizeOrderSummary(order: z.infer<typeof orderBackendSummarySchema>) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    partDescription: order.partDescription,
    salePrice: order.price,
    quantity: order.quantity,
    totalSaleAmount: order.totalSaleAmount,
    status: order.status,
    paymentMethod: order.paymentMethod,
    latestShipmentStatus: order.shipments[0]?.status ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    createdBy: order.createdBy,
    counts: {
      shipments: order._count.shipments,
      notes: order._count.notes,
    },
    latestNote: order.notes[0] ?? null,
  };
}

function normalizeOrderIntakeDetails(
  details: z.infer<typeof orderIntakeDetailsSchema> | null | undefined,
) {
  return {
    advisorName: details?.advisorName ?? null,
    orderDate: details?.orderDate ?? null,
    vehicleMake: details?.vehicleMake ?? null,
    vehicleModel: details?.vehicleModel ?? null,
    vehicleYear: details?.vehicleYear ?? null,
    vehicleVariant: details?.vehicleVariant ?? null,
    vehicleVin: details?.vehicleVin ?? null,
    vehicleNotes: details?.vehicleNotes ?? null,
    vehicleConfiguration: details?.vehicleConfiguration ?? null,
    billingAddress: details?.billingAddress ?? null,
    billingPerson: details?.billingPerson ?? null,
    billingPhone: details?.billingPhone ?? null,
    shippingAddress: details?.shippingAddress ?? null,
    shippingPerson: details?.shippingPerson ?? null,
    shippingPhone: details?.shippingPhone ?? null,
    shippingAt: details?.shippingAt ?? null,
    companyName: details?.companyName ?? null,
    milesOffered: details?.milesOffered ?? null,
    basePrice: details?.basePrice ?? null,
    salesTax: details?.salesTax ?? null,
    shippingCharges: details?.shippingCharges ?? null,
    profit: details?.profit ?? null,
    partialPayment: details?.partialPayment ?? null,
  };
}

const orderBackendDetailSchema = orderBackendSummarySchema.extend({
  shipments: z.array(orderShipmentSchema),
  notes: z.array(orderNoteSchema),
  intakeDetails: orderIntakeDetailsSchema.nullable().optional(),
  invoice: invoiceRecordSchema.nullable().optional(),
});

function requiresPaymentMethod(status: z.infer<typeof orderStatusSchema>): boolean {
  return status === 'PARTIALLY_PAID' || status === 'CONFIRMED';
}

export const orderSummarySchema = orderBackendSummarySchema.transform(
  normalizeOrderSummary,
);

export const ordersListSchema = z
  .object({
    items: z.array(orderBackendSummarySchema),
    meta: paginationMetaSchema,
  })
  .transform(({ items, meta }) => ({
    items: items.map(normalizeOrderSummary),
    meta,
  }));

export const orderDetailSchema = orderBackendDetailSchema.transform((order) => ({
  ...normalizeOrderSummary(order),
  shipments: order.shipments,
  notes: order.notes,
  intakeDetails: normalizeOrderIntakeDetails(order.intakeDetails),
  invoice: order.invoice ?? null,
}));

export const nextOrderNumberSchema = z.object({
  orderNumber: z.string().regex(/^MAP\d{8,}$/, 'Order number format is invalid.'),
});

export const createOrderSchema = z.object({
  leadId: z.string().uuid('Lead identifier is invalid.').optional(),
  advisorName: z
    .string()
    .trim()
    .min(1, 'Advisor name is required.')
    .max(120, 'Advisor name must be 120 characters or fewer.'),
  orderNumber: z
    .string()
    .trim()
    .min(1, 'Order number is required.')
    .max(50, 'Order number must be 50 characters or fewer.'),
  orderDate: z
    .string()
    .trim()
    .min(1, 'Date is required.')
    .max(30, 'Date must be 30 characters or fewer.'),
  customerName: z
    .string()
    .trim()
    .min(1, 'Customer name is required.')
    .max(160, 'Customer name must be 160 characters or fewer.'),
  partDescription: z
    .string()
    .trim()
    .min(1, 'Part description is required.')
    .max(255, 'Part description must be 255 characters or fewer.'),
  customerEmail: optionalEmailSchema,
  customerPhone: optionalPhoneSchema,
  vehicleMake: createOptionalTextSchema(
    120,
    'Make must be 120 characters or fewer.',
  ),
  vehicleModel: createOptionalTextSchema(
    120,
    'Model must be 120 characters or fewer.',
  ),
  vehicleYear: createOptionalTextSchema(
    20,
    'Year must be 20 characters or fewer.',
  ),
  vehicleVariant: createOptionalTextSchema(
    120,
    'Variant must be 120 characters or fewer.',
  ),
  vehicleVin: createOptionalTextSchema(
    60,
    'VIN must be 60 characters or fewer.',
  ),
  vehicleNotes: createOptionalTextSchema(
    1000,
    'Notes must be 1000 characters or fewer.',
  ),
  vehicleConfiguration: createOptionalTextSchema(
    255,
    'Configuration must be 255 characters or fewer.',
  ),
  billingAddress: createOptionalTextSchema(
    500,
    'Billing address must be 500 characters or fewer.',
  ),
  billingPerson: createOptionalTextSchema(
    160,
    'Billing person must be 160 characters or fewer.',
  ),
  billingPhone: createOptionalTextSchema(
    30,
    'Billing phone must be 30 characters or fewer.',
  ),
  shippingAddress: createOptionalTextSchema(
    500,
    'Shipping address must be 500 characters or fewer.',
  ),
  shippingPerson: createOptionalTextSchema(
    160,
    'Shipping person must be 160 characters or fewer.',
  ),
  shippingPhone: createOptionalTextSchema(
    30,
    'Shipping phone must be 30 characters or fewer.',
  ),
  shippingAt: createOptionalTextSchema(
    40,
    'Shipping at must be 40 characters or fewer.',
  ),
  companyName: createOptionalTextSchema(
    160,
    'Company name must be 160 characters or fewer.',
  ),
  milesOffered: optionalNumericValueSchema,
  salePrice: z.coerce
    .number()
    .positive('Sale price must be greater than 0.')
    .refine(
      (value) => Number.isInteger(value * 100),
      'Sale price can include at most 2 decimal places.',
    ),
  basePrice: optionalNumericValueSchema,
  salesTax: optionalNumericValueSchema,
  shippingCharges: optionalNumericValueSchema,
  profit: optionalNumericValueSchema,
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.'),
  total: z.coerce
    .number()
    .positive('Total must be greater than 0.')
    .refine(
      (value) => Number.isInteger(value * 100),
      'Total can include at most 2 decimal places.',
    ),
  partialPayment: optionalNumericValueSchema,
  status: orderStatusSchema,
  paymentMethod: orderPaymentMethodSchema.optional(),
  note: z
    .string()
    .trim()
    .max(1000, 'Notes must be 1000 characters or fewer.')
    .optional(),
}).superRefine((value, context) => {
  if (requiresPaymentMethod(value.status) && !value.paymentMethod) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Payment method is required for partially paid or confirmed orders.',
      path: ['paymentMethod'],
    });
  }

  if (!requiresPaymentMethod(value.status) && value.paymentMethod) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Payment method can only be set for partially paid or confirmed orders.',
      path: ['paymentMethod'],
    });
  }
});

export const createOrderFormSchema = z.object({
  leadId: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().uuid('Lead identifier is invalid.').optional(),
  ),
  advisorName: z
    .string()
    .trim()
    .min(1, 'Advisor name is required.')
    .max(120, 'Advisor name must be 120 characters or fewer.'),
  orderNumber: z
    .string()
    .trim()
    .min(1, 'Order number is required.')
    .max(50, 'Order number must be 50 characters or fewer.'),
  orderDate: z
    .string()
    .trim()
    .min(1, 'Date is required.')
    .max(30, 'Date must be 30 characters or fewer.'),
  customerName: z
    .string()
    .trim()
    .min(1, 'Customer name is required.')
    .max(160, 'Customer name must be 160 characters or fewer.'),
  partDescription: z
    .string()
    .trim()
    .min(1, 'Part description is required.')
    .max(255, 'Part description must be 255 characters or fewer.'),
  customerEmail: z
    .string()
    .max(160, 'Customer email must be 160 characters or fewer.')
    .optional(),
  customerPhone: z
    .string()
    .max(30, 'Customer phone must be 30 characters or fewer.')
    .optional(),
  vehicleMake: z
    .string()
    .max(120, 'Make must be 120 characters or fewer.')
    .optional(),
  vehicleModel: z
    .string()
    .max(120, 'Model must be 120 characters or fewer.')
    .optional(),
  vehicleYear: z
    .string()
    .max(20, 'Year must be 20 characters or fewer.')
    .optional(),
  vehicleVariant: z
    .string()
    .max(120, 'Variant must be 120 characters or fewer.')
    .optional(),
  vehicleVin: z
    .string()
    .max(60, 'VIN must be 60 characters or fewer.')
    .optional(),
  vehicleNotes: z
    .string()
    .max(1000, 'Notes must be 1000 characters or fewer.')
    .optional(),
  vehicleConfiguration: z
    .string()
    .max(255, 'Configuration must be 255 characters or fewer.')
    .optional(),
  billingAddress: z
    .string()
    .max(500, 'Billing address must be 500 characters or fewer.')
    .optional(),
  billingPerson: z
    .string()
    .max(160, 'Billing person must be 160 characters or fewer.')
    .optional(),
  billingPhone: z
    .string()
    .max(30, 'Billing phone must be 30 characters or fewer.')
    .optional(),
  shippingAddress: z
    .string()
    .max(500, 'Shipping address must be 500 characters or fewer.')
    .optional(),
  shippingPerson: z
    .string()
    .max(160, 'Shipping person must be 160 characters or fewer.')
    .optional(),
  shippingPhone: z
    .string()
    .max(30, 'Shipping phone must be 30 characters or fewer.')
    .optional(),
  shippingAt: z
    .string()
    .max(40, 'Shipping at must be 40 characters or fewer.')
    .optional(),
  companyName: z
    .string()
    .max(160, 'Company name must be 160 characters or fewer.')
    .optional(),
  milesOffered: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number()
      .min(0, 'Miles offered must be 0 or greater.')
      .refine(
        (value) => Number.isInteger(value * 100),
        'Miles offered can include at most 2 decimal places.',
      )
      .optional(),
  ),
  salePrice: z.preprocess(
    (val) => (typeof val === 'number' ? String(val) : val),
    z
      .string()
      .trim()
      .min(1, 'Sale price is required.')
      .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount with up to 2 decimals.')
      .transform((value) => Number(value)),
  ),
  basePrice: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number()
      .min(0, 'Base price must be 0 or greater.')
      .refine(
        (value) => Number.isInteger(value * 100),
        'Base price can include at most 2 decimal places.',
      )
      .optional(),
  ),
  salesTax: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number()
      .min(0, 'Sales tax must be 0 or greater.')
      .refine(
        (value) => Number.isInteger(value * 100),
        'Sales tax can include at most 2 decimal places.',
      )
      .optional(),
  ),
  shippingCharges: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number()
      .min(0, 'Shipping charges must be 0 or greater.')
      .refine(
        (value) => Number.isInteger(value * 100),
        'Shipping charges can include at most 2 decimal places.',
      )
      .optional(),
  ),
  profit: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number()
      .min(0, 'Profit must be 0 or greater.')
      .refine(
        (value) => Number.isInteger(value * 100),
        'Profit can include at most 2 decimal places.',
      )
      .optional(),
  ),
  quantity: z.preprocess(
    (val) => (typeof val === 'number' ? String(val) : val),
    z
      .string()
      .trim()
      .min(1, 'Quantity is required.')
      .regex(/^\d+$/, 'Quantity must be a whole number.')
      .transform((value) => Number(value))
      .pipe(
        z
          .number()
          .int('Quantity must be a whole number.')
          .min(1, 'Quantity must be at least 1.'),
      ),
  ),
  total: z.preprocess(
    (val) => (typeof val === 'number' ? String(val) : val),
    z
      .string()
      .trim()
      .min(1, 'Total is required.')
      .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount with up to 2 decimals.')
      .transform((value) => Number(value)),
  ),
  partialPayment: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number()
      .min(0, 'Partial payment must be 0 or greater.')
      .refine(
        (value) => Number.isInteger(value * 100),
        'Partial payment can include at most 2 decimal places.',
      )
      .optional(),
  ),
  status: orderStatusSchema,
  paymentMethod: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    orderPaymentMethodSchema.optional(),
  ),
  note: z
    .string()
    .max(1000, 'Notes must be 1000 characters or fewer.')
    .optional(),
}).superRefine((value, context) => {
  if (requiresPaymentMethod(value.status) && !value.paymentMethod) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Payment method is required for partially paid or confirmed orders.',
      path: ['paymentMethod'],
    });
  }

  if (!requiresPaymentMethod(value.status) && value.paymentMethod) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Payment method can only be set for partially paid or confirmed orders.',
      path: ['paymentMethod'],
    });
  }

  if (
    value.status === 'PARTIALLY_PAID' &&
    (value.partialPayment === undefined || value.partialPayment <= 0)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Partial payment is required for partially paid orders.',
      path: ['partialPayment'],
    });
  }

  if (
    value.status === 'PARTIALLY_PAID' &&
    value.partialPayment !== undefined &&
    value.partialPayment > value.total
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Partial payment cannot be greater than the total.',
      path: ['partialPayment'],
    });
  }
}).pipe(createOrderSchema);

export const updateOrderSchema = z.object({
  customerName: createOptionalTextSchema(
    160,
    'Customer name must be 160 characters or fewer.',
  ),
  partDescription: createOptionalTextSchema(
    255,
    'Part description must be 255 characters or fewer.',
  ),
  customerEmail: optionalEmailSchema,
  customerPhone: optionalPhoneSchema,
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .optional(),
  price: optionalNumericValueSchema,
  total: optionalNumericValueSchema,
  status: orderStatusSchema.optional(),
  paymentMethod: orderPaymentMethodSchema.nullable().optional(),
  advisorName: createOptionalTextSchema(
    120,
    'Advisor name must be 120 characters or fewer.',
  ),
  orderDate: createOptionalTextSchema(30, 'Order date must be 30 characters or fewer.'),
  vehicleMake: createOptionalTextSchema(120, 'Make must be 120 characters or fewer.'),
  vehicleModel: createOptionalTextSchema(120, 'Model must be 120 characters or fewer.'),
  vehicleYear: createOptionalTextSchema(20, 'Year must be 20 characters or fewer.'),
  vehicleVariant: createOptionalTextSchema(120, 'Variant must be 120 characters or fewer.'),
  vehicleVin: createOptionalTextSchema(60, 'VIN must be 60 characters or fewer.'),
  vehicleNotes: createOptionalTextSchema(1000, 'Vehicle notes must be 1000 characters or fewer.'),
  vehicleConfiguration: createOptionalTextSchema(255, 'Configuration must be 255 characters or fewer.'),
  billingAddress: createOptionalTextSchema(500, 'Billing address must be 500 characters or fewer.'),
  billingPerson: createOptionalTextSchema(160, 'Billing person must be 160 characters or fewer.'),
  billingPhone: createOptionalTextSchema(30, 'Billing phone must be 30 characters or fewer.'),
  shippingAddress: createOptionalTextSchema(500, 'Shipping address must be 500 characters or fewer.'),
  shippingPerson: createOptionalTextSchema(160, 'Shipping person must be 160 characters or fewer.'),
  shippingPhone: createOptionalTextSchema(30, 'Shipping phone must be 30 characters or fewer.'),
  shippingAt: createOptionalTextSchema(40, 'Shipping date must be 40 characters or fewer.'),
  companyName: createOptionalTextSchema(160, 'Company name must be 160 characters or fewer.'),
  milesOffered: optionalNumericValueSchema,
  basePrice: optionalNumericValueSchema,
  salesTax: optionalNumericValueSchema,
  shippingCharges: optionalNumericValueSchema,
  profit: optionalNumericValueSchema,
  partialPayment: optionalNumericValueSchema,
  note: z
    .string()
    .trim()
    .max(1000, 'Notes must be 1000 characters or fewer.')
    .optional(),
});

export const updateOrderFormSchema = z.object({
  customerName: z.string().max(160).optional(),
  partDescription: z.string().max(255).optional(),
  customerEmail: z
    .string()
    .max(160, 'Customer email must be 160 characters or fewer.')
    .optional(),
  customerPhone: z
    .string()
    .max(30, 'Customer phone must be 30 characters or fewer.')
    .optional(),
  price: z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().positive().optional()),
  total: z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().positive().optional()),
  status: orderStatusSchema.optional(),
  paymentMethod: z.preprocess(
    (value) => (value === '' ? null : value),
    orderPaymentMethodSchema.nullable().optional(),
  ),
  advisorName: z.string().max(120).optional(),
  orderDate: z.string().max(30).optional(),
  vehicleMake: z.string().max(120).optional(),
  vehicleModel: z.string().max(120).optional(),
  vehicleYear: z.string().max(20).optional(),
  vehicleVariant: z.string().max(120).optional(),
  vehicleVin: z.string().max(60).optional(),
  vehicleNotes: z.string().max(1000).optional(),
  vehicleConfiguration: z.string().max(255).optional(),
  billingAddress: z.string().max(500).optional(),
  billingPerson: z.string().max(160).optional(),
  billingPhone: z.string().max(30).optional(),
  shippingAddress: z.string().max(500).optional(),
  shippingPerson: z.string().max(160).optional(),
  shippingPhone: z.string().max(30).optional(),
  shippingAt: z.string().max(40).optional(),
  companyName: z.string().max(160).optional(),
  milesOffered: z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().min(0).optional()),
  basePrice: z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().min(0).optional()),
  salesTax: z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().min(0).optional()),
  shippingCharges: z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().min(0).optional()),
  profit: z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().min(0).optional()),
  partialPayment: z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().min(0).optional()),
  note: z
    .string()
    .max(1000, 'Notes must be 1000 characters or fewer.')
    .optional(),
}).pipe(updateOrderSchema);

export type CreateOrderFormValues = z.input<typeof createOrderFormSchema>;
export type CreateOrderFormData = z.output<typeof createOrderFormSchema>;
export type CreateOrderPayload = z.infer<typeof createOrderSchema>;
export type UpdateOrderFormValues = z.input<typeof updateOrderFormSchema>;
export type UpdateOrderPayload = z.infer<typeof updateOrderSchema>;
export type OrderStatusValue = z.infer<typeof orderStatusSchema>;
