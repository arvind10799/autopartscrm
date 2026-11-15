import { Prisma, ReminderContext } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { publishReminderSuggestions } from './reminder-suggestions';
type Tx = Prisma.TransactionClient;
const tables = {
  LEAD: 'Lead',
  WEBSITE_LEAD: 'WebsiteLead',
  ORDER: 'Order',
  SHIPMENT_ORDER: 'Order',
  SHIPMENT: 'Shipment',
  REPLACEMENT: 'ReplacementRequest',
  INVOICE: 'Invoice',
} as const;
export async function automationSnapshot(
  tx: Tx,
  context: Exclude<ReminderContext, 'PERSONAL'> | 'INVOICE',
  id: string,
) {
  // Names come only from the fixed internal table map; no request text enters SQL identifiers.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM ${Prisma.raw('"' + tables[context] + '"')} WHERE "id"=${id}::uuid FOR UPDATE`,
  );
  if (context === 'LEAD')
    return tx.lead.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
  if (context === 'WEBSITE_LEAD')
    return tx.websiteLead.findUniqueOrThrow({
      where: { id },
      select: { status: true, assignedToId: true },
    });
  if (context === 'ORDER' || context === 'SHIPMENT_ORDER')
    return tx.order.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
  if (context === 'SHIPMENT')
    return tx.shipment.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
  if (context === 'REPLACEMENT') {
    const r = await tx.replacementRequest.findUniqueOrThrow({
      where: { id },
      select: { replacementStatus: true },
    });
    return { status: r.replacementStatus };
  }
  const r = await tx.invoice.findUniqueOrThrow({
    where: { id },
    select: { orderId: true, signatureRequestedAt: true, signedAt: true },
  });
  return { status: 'INVOICE', ...r };
}
export async function publishChangedSuggestions(
  tx: Tx,
  context: Exclude<ReminderContext, 'PERSONAL'> | 'INVOICE',
  id: string,
  before: Awaited<ReturnType<typeof automationSnapshot>> | null,
) {
  const current = await automationSnapshot(tx, context, id);
  if (context === 'INVOICE') {
    const next = current as {
        orderId: string;
        signatureRequestedAt: Date | null;
        signedAt: Date | null;
      },
      previous = before as typeof next | null;
    if (!next.signatureRequestedAt || next.signedAt)
      await publishReminderSuggestions(
        tx,
        'ORDER',
        next.orderId,
        'SIGNATURE_RESET',
      );
    else if (!previous?.signatureRequestedAt)
      await publishReminderSuggestions(
        tx,
        'ORDER',
        next.orderId,
        'SIGNATURE_REQUEST',
      );
    return;
  }
  const assignedChanged =
    context === 'WEBSITE_LEAD' &&
    ('assignedToId' in current ? current.assignedToId : undefined) !==
      (before && 'assignedToId' in before ? before.assignedToId : undefined);
  if (!before || before.status !== current.status || assignedChanged) {
    const trigger =
      context === 'WEBSITE_LEAD' && current.status === 'NEW'
        ? 'NEW_ASSIGNED'
        : current.status;
    await publishReminderSuggestions(tx, context, id, trigger);
    if (context === 'ORDER' && (!before || before.status !== current.status))
      await publishReminderSuggestions(
        tx,
        'SHIPMENT_ORDER',
        id,
        current.status,
      );
  }
}
export async function createWithSuggestionEvent<T extends { id: string }>(
  client: Tx | PrismaService,
  context: Exclude<ReminderContext, 'PERSONAL'>,
  operation: (tx: Tx) => Promise<T>,
): Promise<T> {
  const run = async (tx: Tx) => {
    const record = await operation(tx);
    await publishChangedSuggestions(tx, context, record.id, null);
    return record;
  };
  return '$transaction' in client ? client.$transaction(run) : run(client);
}
