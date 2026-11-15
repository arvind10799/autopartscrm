import { Prisma, Reminder, ReminderDeliveryKind } from '@prisma/client';

/** Durable intents only. Called inside the record/task transaction; never performs network I/O. */
export async function reminderEvent(
  tx: Prisma.TransactionClient,
  row: Reminder,
  kind: ReminderDeliveryKind,
  recipientIds?: string[],
  now = new Date(),
) {
  const users =
    recipientIds ??
    (row.ownerKind === 'SHIPPING_QUEUE'
      ? (
          await tx.user.findMany({
            where: { role: 'SHIPPING', isActive: true },
            select: { id: true },
          })
        ).map((u) => u.id)
      : row.ownerUserId
        ? [row.ownerUserId]
        : []);
  if (!users.length) return;
  await tx.reminderDelivery.createMany({
    skipDuplicates: true,
    data: [...new Set(users)].flatMap((recipientUserId) =>
      (['BELL', 'PUSH', 'EMAIL'] as const).map((channel) => ({
        reminderId: row.id,
        reminderVersion: row.scheduleVersion,
        recipientUserId,
        kind,
        channel,
        availableAt: now,
      })),
    ),
  });
}
