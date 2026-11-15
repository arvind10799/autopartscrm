import { readReminderPolicy } from './reminder-policy-settings';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { RemindersService } from './reminders.service';
import { RemindersRepository } from './reminders.repository';
import { ReminderQueriesService } from './reminder-queries.service';
import { ReminderActionsService } from './reminder-actions.service';
import { isReminderStatusOnly } from './reminder-policy';
import {
  ReminderAlertActionDto,
  ReminderNotificationSettingsDto,
  ReminderPushDto,
} from './dto/reminder-notification.dto';
import { ReminderCommand } from './dto/reminder-action.dto';
import { reminderSeriesSelect } from './reminder-repeat';

export function validatePushEndpoint(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException('Invalid push endpoint.');
  }
  const host = url.hostname.toLowerCase();
  const allowed =
    host === 'fcm.googleapis.com' ||
    host === 'updates.push.services.mozilla.com' ||
    host.endsWith('.push.apple.com') ||
    host.endsWith('.notify.windows.com');
  if (
    !allowed ||
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== '443')
  )
    throw new BadRequestException('Unsupported push service.');
  return url.toString();
}
@Injectable()
export class ReminderNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: RemindersService,
    private readonly repo: RemindersRepository,
    private readonly queries: ReminderQueriesService,
    private readonly actions: ReminderActionsService,
    private readonly config: ConfigService,
  ) {}
  private active(user: AuthenticatedUser) {
    return this.core.assertActiveActor(this.prisma, user);
  }
  async configuration(user: AuthenticatedUser) {
    await this.active(user);
    const settings = await this.prisma.reminderSettings.findUniqueOrThrow({
      where: { id: 'default' },
    });
    const configured = this.config.get('REMINDERS_DELIVERY_ENABLED') === 'true';
    return {
      enabled: configured && settings.deliveryEnabled,
      publicKey:
        configured && this.config.get('REMINDERS_VAPID_PRIVATE_KEY')
          ? (this.config.get<string>('REMINDERS_VAPID_PUBLIC_KEY') ?? null)
          : null,
    };
  }
  async settings(user: AuthenticatedUser) {
    await this.active(user);
    if (user.role !== 'ADMIN') throw new ForbiddenException();
    const [settings, pending, failed] = await Promise.all([
      this.prisma.reminderSettings.findUniqueOrThrow({
        where: { id: 'default' },
      }),
      this.prisma.reminderDelivery.count({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
      }),
      this.prisma.reminderDelivery.count({ where: { status: 'FAILED' } }),
    ]);
    return {
      ...settings,
      pending,
      failed,
      serverEnabled: this.config.get('REMINDERS_DELIVERY_ENABLED') === 'true',
      pushConfigured: Boolean(
        this.config.get('REMINDERS_VAPID_PUBLIC_KEY') &&
        this.config.get('REMINDERS_VAPID_PRIVATE_KEY') &&
        this.config.get('REMINDERS_VAPID_SUBJECT'),
      ),
      emailConfigured: Boolean(
        this.config.get('SMTP_HOST') &&
        this.config.get('SMTP_USER') &&
        this.config.get('SMTP_PASS'),
      ),
    };
  }
  async updateSettings(
    input: ReminderNotificationSettingsDto,
    user: AuthenticatedUser,
  ) {
    await this.settings(user);
    const data = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    );
    if (
      !Object.keys(data).length ||
      ['deliveryEnabled', 'workingMarkerMinutes'].some((k) => data[k] === null)
    )
      throw new BadRequestException('Invalid settings.');
    await this.prisma.reminderSettings.update({
      where: { id: 'default' },
      data,
    });
    return this.settings(user);
  }
  async subscribe(input: ReminderPushDto, user: AuthenticatedUser) {
    await this.active(user);
    if (!(await this.configuration(user)).publicKey)
      throw new BadRequestException('Browser push is not configured yet.');
    const endpoint = validatePushEndpoint(input.endpoint);
    if (
      !input.keys ||
      Buffer.from(input.keys.p256dh, 'base64url').length !== 65 ||
      Buffer.from(input.keys.auth, 'base64url').length !== 16
    )
      throw new BadRequestException('Invalid subscription keys.');
    if (
      (await this.prisma.reminderPushSubscription.count({
        where: { userId: user.userId },
      })) >= 10 &&
      !(await this.prisma.reminderPushSubscription.findFirst({
        where: { endpoint, userId: user.userId },
      }))
    )
      throw new BadRequestException(
        'The device limit has been reached. Disable notifications on an unused device first.',
      );
    await this.prisma.reminderPushSubscription.upsert({
      where: { endpoint },
      create: { userId: user.userId, endpoint, ...input.keys },
      update: { userId: user.userId, ...input.keys },
    });
    return { saved: true };
  }
  async unsubscribe(endpoint: string, user: AuthenticatedUser) {
    await this.active(user);
    await this.prisma.reminderPushSubscription.deleteMany({
      where: { endpoint, userId: user.userId },
    });
    return { saved: true };
  }
  async alert(id: string, user: AuthenticatedUser) {
    return this.repo.transaction(async (tx) => {
      await this.core.assertActiveActor(tx, user);
      const row = await tx.reminder.findUniqueOrThrow({
        where: { id, deletedAt: null },
        include: {
          series: { select: reminderSeriesSelect },
          owner: { select: { name: true, isActive: true, role: true } },
          createdBy: { select: { name: true } },
          workingBy: { select: { name: true } },
        },
      });
      const record = await this.core.authorize(tx, row, user, 'read');
      const zone =
        (
          await tx.reminderUserPreference.findUnique({
            where: { userId: user.userId },
          })
        )?.displayTimeZone ??
        (await readReminderPolicy(tx)).defaultDisplayTimeZone;
      const statusOnly = isReminderStatusOnly(user, row);
      const href =
        row.context === 'PERSONAL' || statusOnly
          ? null
          : row.context === 'WEBSITE_LEAD'
            ? `/website-leads/${row.websiteLeadId}`
            : row.context === 'LEAD'
              ? `/leads/${row.leadId}`
              : row.context === 'ORDER'
                ? `/orders/${row.orderId}`
                : row.context === 'SHIPMENT_ORDER'
                  ? `/shipments/create/${row.orderId}`
                  : row.context === 'SHIPMENT'
                    ? `/shipments/${row.shipmentId}`
                    : `/replacement-orders/${row.replacementId}`;
      return {
        item: this.queries.present(row, user, record.owner?.id, new Date()),
        displayTimeZone: zone,
        href: href ? `${href}#reminders` : null,
      };
    });
  }
  async action(
    id: string,
    input: ReminderAlertActionDto,
    user: AuthenticatedUser,
  ) {
    if (
      (input.action !== 'SNOOZE' && input.snoozeMinutes !== undefined) ||
      (input.action !== 'COMPLETE' && input.completionNote !== undefined)
    )
      throw new BadRequestException('Invalid action fields.');
    return this.actions.mutate(
      id,
      { ...input, action: input.action as ReminderCommand },
      user,
    );
  }
}
