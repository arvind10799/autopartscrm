import { Prisma } from '@prisma/client';
import {
  customerTimeZone,
  DEFAULT_REMINDER_TIME_ZONE,
  normalizeUsState,
} from './reminder-time';
export const defaultReminderPolicy = {
  callingWindowEnabled: true,
  callingStartMinute: 480,
  callingEndMinute: 1200,
  snoozeMinutes: [15, 60, 1440, 4320],
  defaultDisplayTimeZone: DEFAULT_REMINDER_TIME_ZONE,
  stateTimeZones: {} as Record<string, string>,
  policyVersion: 1,
};
export const policySelect = {
  callingWindowEnabled: true,
  callingStartMinute: true,
  callingEndMinute: true,
  snoozeMinutes: true,
  defaultDisplayTimeZone: true,
  stateTimeZones: true,
  policyVersion: true,
} as const;
export async function readReminderPolicy(tx: Prisma.TransactionClient) {
  return (
    (await tx.reminderSettings.findUnique({
      where: { id: 'default' },
      select: policySelect,
    })) ?? defaultReminderPolicy
  );
}
export async function configuredCustomerTimeZone(
  tx: Prisma.TransactionClient,
  state?: string | null,
) {
  const code = normalizeUsState(state),
    settings = await readReminderPolicy(tx);
  return (
    (code && (settings.stateTimeZones as Record<string, string>)[code]) ||
    customerTimeZone(state)
  );
}
