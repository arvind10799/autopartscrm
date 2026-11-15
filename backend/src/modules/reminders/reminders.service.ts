import { readReminderPolicy } from './reminder-policy-settings';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, Reminder, ReminderOwnerKind } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  CreateReminderDto,
  ReminderAssignment,
} from './dto/create-reminder.dto';
import {
  assertReminderAccess,
  ReminderAction,
  SHIPPING_CONTEXTS,
} from './reminder-policy';
import { resolveReminderRecord } from './reminder-record';
import {
  DEFAULT_REMINDER_TIME_ZONE,
  resolveReminderTime,
} from './reminder-time';
import { RemindersRepository } from './reminders.repository';
import { repeatTemplate, validateRepeat } from './reminder-repeat';

/** Core ownership, creation, and queue markers shared by record actions and later task views. */
@Injectable()
export class RemindersService {
  constructor(private readonly repository: RemindersRepository) {}

  async create(
    input: CreateReminderDto,
    user: AuthenticatedUser,
    now = new Date(),
  ) {
    return this.repository.transaction((tx) =>
      this.createInTransaction(tx, input, user, now),
    );
  }
  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: CreateReminderDto,
    user: AuthenticatedUser,
    now = new Date(),
  ) {
    const dto = plainToInstance(CreateReminderDto, input);
    if (
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length
    )
      throw new BadRequestException('Invalid reminder fields.');
    await this.assertActiveActor(tx, user);
    const record = await resolveReminderRecord(tx, dto.context, dto.recordId);
    if (record.closed)
      throw new BadRequestException(
        'New reminders cannot be added to a closed or converted record.',
      );
    const personal = dto.context === 'PERSONAL';
    const shippingContext = SHIPPING_CONTEXTS.includes(dto.context);
    if (
      user.role === Role.SALES &&
      !personal &&
      (shippingContext || record.owner?.id !== user.userId)
    )
      throw new ForbiddenException(
        'Sales reminders must start on your own Sales records.',
      );
    if (user.role === Role.SHIPPING && !personal && !shippingContext)
      throw new ForbiddenException(
        'Shipping reminders must start on Shipping records.',
      );

    const assignment =
      dto.assignment ??
      (personal ? ReminderAssignment.SELF : ReminderAssignment.RECORD_OWNER);
    let context = dto.context;
    let ownerKind: ReminderOwnerKind = shippingContext
      ? 'SHIPPING_QUEUE'
      : 'USER';
    let ownerUserId = personal ? user.userId : record.owner?.id;
    let isHandoff = false;
    if (personal && assignment !== ReminderAssignment.SELF)
      throw new BadRequestException('Personal tasks belong to their creator.');
    if (assignment === ReminderAssignment.SELF) {
      if (
        !personal &&
        user.role !== Role.ADMIN &&
        (shippingContext || record.owner?.id !== user.userId)
      )
        throw new ForbiddenException(
          'This reminder cannot be assigned to you.',
        );
      ownerKind = 'USER';
      ownerUserId = user.userId;
    } else if (assignment === ReminderAssignment.SHIPPING_QUEUE) {
      if (!record.links.orderId || user.role === Role.SHIPPING)
        throw new ForbiddenException(
          'Only Sales or Admin can hand an order to Shipping.',
        );
      context = 'SHIPMENT_ORDER';
      ownerKind = 'SHIPPING_QUEUE';
      ownerUserId = undefined;
      isHandoff = true;
    } else if (assignment === ReminderAssignment.SALES_AGENT) {
      if (!shippingContext || !record.links.orderId || user.role === Role.SALES)
        throw new ForbiddenException(
          'Sales handoffs must come from a Shipping record.',
        );
      context = 'ORDER';
      ownerKind = 'USER';
      ownerUserId = record.owner?.id;
      isHandoff = true;
    }
    if (ownerKind === 'SHIPPING_QUEUE') ownerUserId = undefined;
    if (ownerKind === 'USER' && !ownerUserId)
      throw new BadRequestException(
        'Assign the website inquiry first, or create an Admin-owned reminder.',
      );
    if (
      ownerUserId !== user.userId &&
      ownerKind === 'USER' &&
      (!record.owner?.isActive ||
        ![Role.ADMIN, Role.SALES].includes(record.owner.role as Role))
    )
      throw new BadRequestException(
        'The record owner is inactive or is not a Sales/Admin user.',
      );

    const type = await tx.reminderType.findUnique({
      where: { key: dto.typeKey },
    });
    const targetRole =
      ownerKind === 'SHIPPING_QUEUE'
        ? Role.SHIPPING
        : (record.owner?.role as Role);
    if (
      !type?.isActive ||
      !(
        type.allowedRoles.includes(user.role) ||
        (isHandoff && type.allowedRoles.includes(targetRole))
      )
    )
      throw new BadRequestException(
        'Reminder type is not available for your role.',
      );
    const preference = personal
      ? await tx.reminderUserPreference.findUnique({
          where: { userId: user.userId },
        })
      : null;
    if (!personal && dto.timeZone !== undefined)
      throw new BadRequestException(
        'Customer reminder time zones come from the linked record.',
      );
    const schedule = resolveReminderTime(
      dto.localDueAt,
      personal
        ? (dto.timeZone ??
            preference?.displayTimeZone ??
            (await readReminderPolicy(tx)).defaultDisplayTimeZone)
        : record.timeZone,
      now,
      dto.utcOffsetMinutes,
    );
    const duplicate = await tx.reminder.findFirst({
      where: {
        ...(personal ? { ownerUserId: user.userId } : {}),
        ...record.links,
        context,
        typeKey: dto.typeKey,
        deletedAt: null,
        status: { in: ['OPEN', 'SNOOZED'] },
        dueAt: {
          gte: new Date(schedule.dueAt.getTime() - 3600000),
          lte: new Date(schedule.dueAt.getTime() + 3600000),
        },
      },
      select: { id: true },
    });
    if (duplicate && !dto.acknowledgeDuplicate)
      throw new ConflictException(
        'A reminder of this type already exists on this record within one hour. Confirm Save anyway to continue.',
      );
    const repeat = validateRepeat(dto.repeat, context, schedule.localDueAt);
    const row = await this.repository.create(
      tx,
      {
        title: dto.title.trim(),
        typeKey: dto.typeKey,
        context,
        originContext: context === 'PERSONAL' ? null : context,
        originRecordId:
          context === 'PERSONAL'
            ? null
            : (record.links.websiteLeadId ??
              record.links.leadId ??
              (context === 'SHIPMENT'
                ? record.links.shipmentId
                : context === 'REPLACEMENT'
                  ? record.links.replacementId
                  : record.links.orderId)),
        ...record.links,
        ownerKind,
        ownerUserId,
        createdById: user.userId,
        isHandoff,
        assignedByAdmin:
          user.role === Role.ADMIN &&
          (ownerKind === 'SHIPPING_QUEUE' || ownerUserId !== user.userId),
        notifyCreatorOnCompletion: dto.notifyCreatorOnCompletion ?? isHandoff,
        priority: dto.priority ?? 'MEDIUM',
        note: dto.note?.trim() || null,
        earlyAlertMinutes: dto.earlyAlertMinutes ?? 0,
        ...schedule,
      },
      user.userId,
    );
    if (!repeat) return row;
    const series = await tx.reminderSeries.create({
      data: {
        ...repeat,
        anchorLocalAt: row.localDueAt,
        lastScheduledLocalAt: row.localDueAt,
        timeZone: row.timeZone,
        createdById: row.createdById,
        template: repeatTemplate(row),
      },
    });
    const linked = await tx.reminder.update({
      where: { id: row.id },
      data: { seriesId: series.id, occurrenceNumber: 1 },
    });
    await tx.reminderHistory.create({
      data: {
        reminderId: row.id,
        actorId: user.userId,
        action: 'EDITED',
        changes: {
          seriesId: series.id,
          repeat: repeat as Prisma.InputJsonObject,
        },
      },
    });
    return linked;
  }

  get(id: string, user: AuthenticatedUser) {
    return this.repository.transaction(async (tx) => {
      await this.assertActiveActor(tx, user);
      const reminder = await this.repository.find(tx, id);
      await this.authorize(tx, reminder, user, 'read');
      return reminder;
    });
  }

  markWorking(
    id: string,
    version: number,
    user: AuthenticatedUser,
    now = new Date(),
  ) {
    return this.repository.transaction(async (tx) => {
      await this.assertActiveActor(tx, user);
      const reminder = await this.repository.find(tx, id);
      await this.authorize(tx, reminder, user, 'work');
      if (reminder.ownerKind !== 'SHIPPING_QUEUE')
        throw new BadRequestException(
          'Only queue reminders support Working on it.',
        );
      if (!['OPEN', 'SNOOZED'].includes(reminder.status))
        throw new ConflictException('This reminder is closed.');
      if (
        reminder.workingById &&
        reminder.workingById !== user.userId &&
        reminder.workingUntil &&
        reminder.workingUntil > now
      )
        throw new ConflictException(
          'Another Shipping user is working on this reminder.',
        );
      const settings = await tx.reminderSettings.findUnique({
        where: { id: 'default' },
      });
      const workingUntil = new Date(
        now.getTime() + (settings?.workingMarkerMinutes ?? 120) * 60000,
      );
      return this.repository.updateWithHistory(
        tx,
        id,
        version,
        { workingById: user.userId, workingUntil },
        user.userId,
        'WORK_STARTED',
        { workingById: user.userId, workingUntil: workingUntil.toISOString() },
      );
    });
  }

  async authorize(
    tx: Prisma.TransactionClient,
    reminder: Reminder,
    user: AuthenticatedUser,
    action: ReminderAction,
  ) {
    const recordId =
      reminder.context === 'WEBSITE_LEAD'
        ? reminder.websiteLeadId
        : reminder.context === 'LEAD'
          ? reminder.leadId
          : reminder.context === 'SHIPMENT'
            ? reminder.shipmentId
            : reminder.context === 'REPLACEMENT'
              ? reminder.replacementId
              : reminder.orderId;
    const record = await resolveReminderRecord(
      tx,
      reminder.context,
      recordId ?? undefined,
    );
    assertReminderAccess(user, reminder, action, record.owner?.id);
    return record;
  }

  async assertActiveActor(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
  ) {
    const actor = await tx.user.findUnique({
      where: { id: user.userId },
      select: { isActive: true, role: true },
    });
    if (!actor?.isActive || actor.role !== user.role)
      throw new ForbiddenException('User is inactive or permissions changed.');
  }
}
