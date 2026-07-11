import { z } from 'zod';

const optionalInvoiceTextSchema = (maxLength: number, message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmedValue = value.trim();
      return trimmedValue.length > 0 ? trimmedValue : undefined;
    },
    z.string().max(maxLength, message).optional(),
  );

const invoiceAmountSchema = z.coerce
  .number()
  .min(0, 'Amount must be 0 or greater.')
  .refine(
    (value) => Number.isInteger(value * 100),
    'Amount can include at most 2 decimal places.',
  );

const optionalDateSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  },
  z.string().optional(),
);

export const invoiceRecordSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  salesAssistant: z.string().nullable(),
  customerName: z.string(),
  contactNumber: z.string().nullable(),
  billingAddress: z.string().nullable(),
  shippingAddress: z.string().nullable(),
  shippingVendor: z.string(),
  deliveryTimeline: z.string(),
  itemDescription: z.string(),
  vehiclePartDescription: z.string().nullable(),
  quantity: z.number(),
  saleAmount: z.coerce.number(),
  paymentStatus: z.string().nullable(),
  paymentDate: z.string().nullable(),
  paymentSource: z.string().nullable(),
  shippingCost: z.coerce.number(),
  salesTaxes: z.coerce.number(),
  coreCharge: z.coerce.number(),
  totalAmount: z.coerce.number(),
  customerSignature: z.string().nullable(),
  signatureDate: z.string().nullable(),
  status: z.string(),
  pdfStorageKey: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const invoiceDefaultsSchema = z.object({
  invoiceNumber: z.string(),
  invoiceDate: z.string(),
  salesAssistant: z.string(),
  customerName: z.string(),
  contactNumber: z.string(),
  billingAddress: z.string(),
  shippingAddress: z.string(),
  shippingVendor: z.string(),
  deliveryTimeline: z.string(),
  itemDescription: z.string(),
  vehiclePartDescription: z.string(),
  quantity: z.number(),
  saleAmount: z.coerce.number(),
  paymentStatus: z.string(),
  paymentDate: z.string(),
  paymentSource: z.string(),
  shippingCost: z.coerce.number(),
  salesTaxes: z.coerce.number(),
  coreCharge: z.coerce.number(),
  totalAmount: z.coerce.number(),
  customerSignature: z.string(),
  signatureDate: z.string(),
});

export const createInvoiceSchema = z
  .object({
    invoiceNumber: z
      .string()
      .trim()
      .min(1, 'Invoice number is required.')
      .max(50, 'Invoice number must be 50 characters or fewer.'),
    invoiceDate: z.string().trim().min(1, 'Invoice date is required.'),
    salesAssistant: optionalInvoiceTextSchema(
      120,
      'Sales assistant must be 120 characters or fewer.',
    ),
    customerName: z
      .string()
      .trim()
      .min(1, 'Customer name is required.')
      .max(160, 'Customer name must be 160 characters or fewer.'),
    contactNumber: optionalInvoiceTextSchema(
      30,
      'Contact number must be 30 characters or fewer.',
    ),
    billingAddress: optionalInvoiceTextSchema(
      1000,
      'Billing address must be 1000 characters or fewer.',
    ),
    shippingAddress: optionalInvoiceTextSchema(
      1000,
      'Shipping address must be 1000 characters or fewer.',
    ),
    shippingVendor: z
      .string()
      .trim()
      .min(1, 'Shipping vendor is required.')
      .max(80, 'Shipping vendor must be 80 characters or fewer.'),
    deliveryTimeline: z
      .string()
      .trim()
      .min(1, 'Delivery timeline is required.')
      .max(120, 'Delivery timeline must be 120 characters or fewer.'),
    itemDescription: z
      .string()
      .trim()
      .min(1, 'Item description is required.')
      .max(255, 'Item description must be 255 characters or fewer.'),
    vehiclePartDescription: optionalInvoiceTextSchema(
      255,
      'Vehicle / part description must be 255 characters or fewer.',
    ),
    quantity: z.coerce
      .number()
      .int('Quantity must be a whole number.')
      .min(1, 'Quantity must be at least 1.'),
    saleAmount: invoiceAmountSchema,
    paymentStatus: optionalInvoiceTextSchema(
      80,
      'Payment status must be 80 characters or fewer.',
    ),
    paymentDate: optionalDateSchema,
    paymentSource: optionalInvoiceTextSchema(
      160,
      'Payment source must be 160 characters or fewer.',
    ),
    shippingCost: invoiceAmountSchema,
    salesTaxes: invoiceAmountSchema,
    coreCharge: invoiceAmountSchema,
    customerSignature: optionalInvoiceTextSchema(
      160,
      'Customer signature must be 160 characters or fewer.',
    ),
    signatureDate: optionalDateSchema,
  })
  .superRefine((value, context) => {
    const total =
      value.saleAmount - value.shippingCost - value.salesTaxes - value.coreCharge;

    if (total < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Total amount cannot be negative.',
        path: ['coreCharge'],
      });
    }
  });

export type CreateInvoiceFormValues = z.input<typeof createInvoiceSchema>;
export type CreateInvoicePayload = z.output<typeof createInvoiceSchema>;
