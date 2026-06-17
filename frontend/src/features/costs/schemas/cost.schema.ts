import { z } from 'zod';
import { SHIPMENT_STATUSES } from '@/features/shipments/types/shipment.types';

const shipmentStatusSchema = z.enum(SHIPMENT_STATUSES);
const entityIdSchema = z.string().uuid();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const currencyCodeSchema = z
  .string()
  .trim()
  .min(3, 'Currency code must be at least 3 characters.')
  .max(10, 'Currency code must be 10 characters or fewer.')
  .regex(/^[A-Za-z]{3,10}$/, 'Currency code must contain only letters.')
  .transform((value) => value.toUpperCase());
const amountSchema = z
  .coerce
  .number()
  .finite('Enter a valid amount.')
  .min(0, 'Amount cannot be negative.')
  .refine(
    (value) => Number.isInteger(value * 100),
    'Amount can include at most 2 decimal places.',
  );
const amountInputSchema = z
  .string()
  .trim()
  .min(1, 'Amount is required.')
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount with up to 2 decimals.')
  .transform((value) => Number(value));

const shipmentCostBackendSchema = z.object({
  id: entityIdSchema,
  shipmentId: entityIdSchema,
  purchaseAmount: z.coerce.number(),
  shippingAmount: z.coerce.number(),
  additionalAmount: z.coerce.number(),
  grossProfit: z.coerce.number(),
  currency: z.string(),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  shipment: z.object({
    id: entityIdSchema,
    proNumber: z.string().nullable(),
    status: shipmentStatusSchema,
    orderId: entityIdSchema,
    order: z.object({
      id: entityIdSchema,
      orderNumber: z.string(),
      totalSaleAmount: z.coerce.number(),
    }),
  }),
});

export const shipmentCostSchema = shipmentCostBackendSchema.transform((cost) => ({
  id: cost.id,
  shipmentId: cost.shipmentId,
  purchaseAmount: cost.purchaseAmount,
  shippingCharges: cost.shippingAmount,
  additionalCharges: cost.additionalAmount,
  gp: cost.grossProfit,
  currency: cost.currency,
  notes: cost.notes,
  createdAt: cost.createdAt,
  updatedAt: cost.updatedAt,
  shipment: {
    id: cost.shipment.id,
    proNumber: cost.shipment.proNumber,
    currentStatus: cost.shipment.status,
    orderId: cost.shipment.orderId,
    order: cost.shipment.order,
  },
}));

export const createShipmentCostSchema = z.object({
  shipmentId: entityIdSchema,
  purchaseAmount: amountSchema,
  shippingCharges: amountSchema,
  additionalCharges: amountSchema,
  currency: currencyCodeSchema,
});

export const updateShipmentCostSchema = createShipmentCostSchema.omit({
  shipmentId: true,
});

export const shipmentCostFormSchema = z
  .object({
    shipmentId: entityIdSchema,
    purchaseAmount: amountInputSchema,
    shippingCharges: amountInputSchema,
    additionalCharges: amountInputSchema,
    currency: currencyCodeSchema,
  })
  .pipe(createShipmentCostSchema);

export type ShipmentCostFormValues = z.input<typeof shipmentCostFormSchema>;
export type CreateShipmentCostData = z.output<typeof createShipmentCostSchema>;
export type UpdateShipmentCostData = z.output<typeof updateShipmentCostSchema>;
