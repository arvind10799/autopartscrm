import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReminderHistoryAction } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { reminderEvent } from './reminder-delivery-events';

@Injectable()
export class RemindersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034'
        )
          throw error;
        if (attempt === 2)
          throw new ConflictException(
            'The reminder changed. Refresh and try again.',
          );
      }
    }
    throw new ConflictException('The reminder changed.');
  }

  async find(tx: Prisma.TransactionClient, id: string) {
    const reminder = await tx.reminder.findFirst({
      where: { id, deletedAt: null },
    });
    if (!reminder) throw new NotFoundException('Reminder was not found.');
    return reminder;
  }

  async create(
    tx: Prisma.TransactionClient,
    data: Prisma.ReminderUncheckedCreateInput,
    actorId: string,
  ) {
    const row = await tx.reminder.create({
      data: {
        ...data,
        histories: {
          create: {
            actorId,
            action: data.isHandoff ? 'HANDED_OFF' : 'CREATED',
            changes: {
              context: data.context,
              ownerKind: data.ownerKind,
              ownerUserId: data.ownerUserId ?? null,
            },
          },
        },
      },
    });
    if (row.isHandoff || row.assignedByAdmin)
      await reminderEvent(tx, row, 'ASSIGNED');
    return row;
  }

  async updateWithHistory(
    tx: Prisma.TransactionClient,
    id: string,
    version: number,
    data: Prisma.ReminderUncheckedUpdateManyInput,
    actorId: string,
    action: ReminderHistoryAction,
    changes: Prisma.InputJsonObject,
  ) {
    const updated = await tx.reminder.updateMany({
      where: { id, version, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new ConflictException(
        'The reminder changed. Refresh and try again.',
      );
    await tx.reminderHistory.create({
      data: { reminderId: id, actorId, action, changes },
    });
    // A successful soft delete must return its retained row, not reapply the open-list filter.
    const row = await tx.reminder.findUniqueOrThrow({ where: { id } });
    if (action === 'COMPLETED' && row.notifyCreatorOnCompletion)
      await reminderEvent(
        tx,
        row,
        'COMPLETED',
        row.createdById !== actorId ? [row.createdById] : [],
      );
    return row;
  }
}
