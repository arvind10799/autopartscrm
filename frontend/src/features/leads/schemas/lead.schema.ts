import { z } from 'zod';
import { LEAD_STATUSES } from '../types/lead.types';

const userRoleSchema = z.enum(['ADMIN', 'SALES', 'SHIPPING']);
const numericAmountSchema = z.coerce.number().finite();
const leadStatusSchema = z.enum(LEAD_STATUSES);
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
  partDescription: z.string(),
  quote: numericAmountSchema.nullable(),
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
    partDescription: lead.partDescription,
    quote: lead.quote,
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
  cmpt: z
    .string()
    .trim()
    .min(1, 'CMPT is required.')
    .max(80, 'CMPT must be 80 characters or fewer.'),
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
  partDescription: z
    .string()
    .trim()
    .min(1, 'Part description is required.')
    .max(255, 'Part description must be 255 characters or fewer.'),
  quote: optionalNumericValueSchema,
  comments: z
    .string()
    .trim()
    .max(2000, 'Comments must be 2000 characters or fewer.')
    .optional(),
  prospects: z
    .string()
    .trim()
    .min(1, 'Disposition is required.')
    .max(255, 'Disposition must be 255 characters or fewer.'),
  status: leadStatusSchema,
});

export const createLeadFormSchema = z.object({
  leadDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Lead date is required.'),
  cmpt: z
    .string()
    .max(80, 'CMPT must be 80 characters or fewer.'),
  customerPhone: z
    .string()
    .max(30, 'Phone number must be 30 characters or fewer.'),
  customerName: z
    .string()
    .max(160, 'Customer name must be 160 characters or fewer.'),
  partDescription: z
    .string()
    .max(255, 'Part description must be 255 characters or fewer.'),
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
  comments: z
    .string()
    .max(2000, 'Comments must be 2000 characters or fewer.')
    .optional(),
  prospects: z
    .string()
    .max(255, 'Disposition must be 255 characters or fewer.'),
  status: leadStatusSchema,
}).pipe(createLeadSchema);

export type CreateLeadFormValues = z.input<typeof createLeadFormSchema>;
export const updateLeadSchema = createLeadSchema;
export const updateLeadFormSchema = createLeadFormSchema;
export type UpdateLeadFormValues = CreateLeadFormValues;
