import { z } from 'zod';
import { LEAD_QUOTE_CURRENCIES, LEAD_STATUSES } from '../types/lead.types';

const userRoleSchema = z.enum(['ADMIN', 'SALES', 'SHIPPING']);
const numericAmountSchema = z.coerce.number().finite();
const leadStatusSchema = z.enum(LEAD_STATUSES);
const leadQuoteCurrencySchema = z.enum(LEAD_QUOTE_CURRENCIES);
const cmptSchema = z.enum(['YES', 'NO'], {
  errorMap: () => ({ message: 'CMPT must be YES or NO.' }),
});
const cmptFormSchema = z
  .string()
  .refine((value) => value === 'YES' || value === 'NO', 'CMPT is required.');
const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

const leadUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
});

const convertedOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.string(),
});

const leadBackendSummarySchema = z.object({
  id: z.string(),
  leadDate: z.string(),
  adviserName: z.string(),
  cmpt: z.string(),
  customerPhone: z.string(),
  customerName: z.string(),
  customerEmail: z.string().email().nullable(),
  state: z.string().nullable(),
  partDescription: z.string(),
  vehicleYear: z.string().nullable(),
  vehicleMake: z.string().nullable(),
  vehicleModel: z.string().nullable(),
  vehicleVariant: z.string().nullable(),
  quote: numericAmountSchema.nullable(),
  quoteCurrency: leadQuoteCurrencySchema,
  comments: z.string().nullable(),
  prospects: z.string(),
  status: leadStatusSchema,
  convertedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: leadUserSchema,
  convertedOrder: convertedOrderSchema.nullable(),
});

function normalizeLeadSummary(lead: z.infer<typeof leadBackendSummarySchema>) {
  return {
    id: lead.id,
    date: lead.leadDate.slice(0, 10),
    adviserName: lead.adviserName,
    cmpt: lead.cmpt,
    customerPhone: lead.customerPhone,
    customerName: lead.customerName,
    customerEmail: lead.customerEmail,
    state: lead.state,
    partDescription: lead.partDescription,
    vehicleYear: lead.vehicleYear,
    vehicleMake: lead.vehicleMake,
    vehicleModel: lead.vehicleModel,
    vehicleVariant: lead.vehicleVariant,
    quote: lead.quote,
    quoteCurrency: lead.quoteCurrency,
    comments: lead.comments,
    prospects: lead.prospects,
    status: lead.status,
    isConverted: lead.convertedAt !== null,
    convertedAt: lead.convertedAt,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    createdBy: lead.createdBy,
    convertedOrder: lead.convertedOrder,
  };
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
    .min(0, 'Quote must be 0 or greater.')
    .refine(
      (value) => Number.isInteger(value * 100),
      'Quote can include at most 2 decimal places.',
    )
    .optional(),
);

export const leadSummarySchema = leadBackendSummarySchema.transform(
  normalizeLeadSummary,
);

export const leadsListSchema = z
  .object({
    items: z.array(leadBackendSummarySchema),
    meta: paginationMetaSchema,
  })
  .transform(({ items, meta }) => ({
    items: items.map(normalizeLeadSummary),
    meta,
  }));

export const createLeadSchema = z.object({
  leadDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Lead date is required.'),
  cmpt: cmptSchema,
  customerPhone: z
    .string()
    .trim()
    .min(1, 'Phone number is required.')
    .max(30, 'Phone number must be 30 characters or fewer.'),
  customerName: z
    .string()
    .trim()
    .min(1, 'Customer name is required.')
    .max(160, 'Customer name must be 160 characters or fewer.'),
  customerEmail: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(160, 'Email must be 160 characters or fewer.')
    .optional()
    .or(z.literal('')),
  state: z
    .string()
    .trim()
    .max(80, 'State must be 80 characters or fewer.')
    .optional(),
  vehicleYear: z
    .string()
    .trim()
    .min(1, 'Year is required.')
    .max(10, 'Year must be 10 characters or fewer.'),
  vehicleMake: z
    .string()
    .trim()
    .min(1, 'Make is required.')
    .max(80, 'Make must be 80 characters or fewer.'),
  vehicleModel: z
    .string()
    .trim()
    .min(1, 'Model is required.')
    .max(80, 'Model must be 80 characters or fewer.'),
  vehicleVariant: z
    .string()
    .trim()
    .max(80, 'Variant must be 80 characters or fewer.')
    .optional(),
  quote: optionalNumericValueSchema,
  quoteCurrency: leadQuoteCurrencySchema.optional().default('USD'),
  comments: z
    .string()
    .trim()
    .max(2000, 'Comments must be 2000 characters or fewer.')
    .optional(),
  prospects: z
    .string()
    .trim()
    .max(255, 'Disposition must be 255 characters or fewer.')
    .optional()
    .default(''),
  status: leadStatusSchema,
});

export const createLeadFormSchema = z.object({
  leadDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Lead date is required.'),
  cmpt: cmptFormSchema,
  customerPhone: z
    .string()
    .max(30, 'Phone number must be 30 characters or fewer.'),
  customerName: z
    .string()
    .max(160, 'Customer name must be 160 characters or fewer.'),
  customerEmail: z
    .string()
    .max(160, 'Email must be 160 characters or fewer.')
    .optional(),
  state: z
    .string()
    .max(80, 'State must be 80 characters or fewer.')
    .optional(),
  vehicleYear: z
    .string()
    .max(10, 'Year must be 10 characters or fewer.'),
  vehicleMake: z
    .string()
    .max(80, 'Make must be 80 characters or fewer.'),
  vehicleModel: z
    .string()
    .max(80, 'Model must be 80 characters or fewer.'),
  vehicleVariant: z
    .string()
    .max(80, 'Variant must be 80 characters or fewer.')
    .optional(),
  quote: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce
      .number()
      .min(0, 'Quote must be 0 or greater.')
      .refine(
        (value) => Number.isInteger(value * 100),
        'Quote can include at most 2 decimal places.',
      )
      .optional(),
  ),
  quoteCurrency: leadQuoteCurrencySchema,
  comments: z
    .string()
    .max(2000, 'Comments must be 2000 characters or fewer.')
    .optional(),
  prospects: z
    .string()
    .max(255, 'Disposition must be 255 characters or fewer.')
    .optional(),
  status: leadStatusSchema,
}).pipe(createLeadSchema);

export type CreateLeadFormValues = z.input<typeof createLeadFormSchema>;
export const updateLeadSchema = createLeadSchema;
export const updateLeadFormSchema = createLeadFormSchema;
export type UpdateLeadFormValues = CreateLeadFormValues;
