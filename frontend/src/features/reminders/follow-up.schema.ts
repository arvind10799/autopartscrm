import { z } from "zod";
export const followUpSchema = z.object({
  id: z.string().uuid(),
  typeLabel: z.string(),
  dueAt: z.string(),
  timeZone: z.string(),
  status: z.string(),
  overdue: z.boolean(),
});
export type TableFollowUp = z.infer<typeof followUpSchema>;
