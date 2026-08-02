import { z } from 'zod';

export const vehicleLookupOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const vehicleLookupResponseSchema = z.object({
  items: z.array(vehicleLookupOptionSchema),
});

