import { z } from "zod";
const displayZones = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
] as const;
export const defaultPolicy = {
  callingWindowEnabled: true,
  callingStartMinute: 480,
  callingEndMinute: 1200,
  snoozeMinutes: [15, 60, 1440, 4320],
  defaultDisplayTimeZone: "America/Los_Angeles",
  stateTimeZones: {},
  policyVersion: 1,
};
export const reminderPolicySchema = z.object({
  callingWindowEnabled: z.boolean(),
  callingStartMinute: z.number().int().min(0).max(1439),
  callingEndMinute: z.number().int().min(0).max(1439),
  snoozeMinutes: z.array(z.number().int().min(1).max(43200)).min(1).max(8),
  defaultDisplayTimeZone: z.enum(displayZones),
  stateTimeZones: z.record(z.enum([...displayZones, "America/Phoenix"])),
  policyVersion: z.number().int().positive(),
});
export type ReminderPolicy = z.infer<typeof reminderPolicySchema>;
