import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma/prisma.service';
import { validatePushEndpoint } from './reminder-notification.service';
import { reminderChannelSettings } from './reminder-worker-status';
import type { ReminderPushSubscription } from '@prisma/client';

export type ReminderMessage = {
  title: string;
  body: string;
  href: string;
  reminderId: string;
  userId: string;
};
@Injectable()
export class ReminderTransportService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}
  pushConfigured() {
    return reminderChannelSettings(this.config).pushConfigured;
  }
  emailConfigured() {
    const settings = reminderChannelSettings(this.config);
    return settings.emailEnabled && settings.emailConfigured;
  }
  async push(deliveryId: string, userId: string, payload: ReminderMessage) {
    if (!this.pushConfigured()) return false;
    const subscriptions = await this.prisma.reminderPushSubscription.findMany({
      where: { userId },
      take: 10,
    });
    if (!subscriptions.length) return false;
    const results = await Promise.allSettled(
      subscriptions.map(async (s) => {
        if (
          await this.prisma.reminderPushReceipt.findUnique({
            where: {
              deliveryId_subscriptionId: { deliveryId, subscriptionId: s.id },
            },
          })
        )
          return true;
        try {
          validatePushEndpoint(s.endpoint);
          await this.sendPush(s, payload);
          // The browser may have detached while the push service was accepting it.
          if (
            await this.prisma.reminderPushSubscription.findFirst({
              where: { id: s.id, userId },
            })
          )
            await this.prisma.reminderPushReceipt.upsert({
              where: {
                deliveryId_subscriptionId: { deliveryId, subscriptionId: s.id },
              },
              create: { deliveryId, subscriptionId: s.id },
              update: {},
            });
          return true;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.prisma.reminderPushSubscription.deleteMany({
              where: { id: s.id, userId },
            });
            return false;
          }
          // Do not retain transport bodies/endpoints/keys in the error log.
          throw new Error(
            status
              ? `Push provider status ${status}`
              : 'Push delivery could not be confirmed',
          );
        }
      }),
    );
    if (results.some((r) => r.status === 'rejected'))
      throw new Error('One or more device deliveries could not be confirmed');
    return results.some((r) => r.status === 'fulfilled' && r.value);
  }
  protected async sendPush(
    s: ReminderPushSubscription,
    payload: ReminderMessage,
  ) {
    // Native dynamic import: web-push 4 is ESM; the Nest application is CommonJS.
    const webpush = await import('web-push');
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: this.config.getOrThrow('REMINDERS_VAPID_SUBJECT'),
          publicKey: this.config.getOrThrow('REMINDERS_VAPID_PUBLIC_KEY'),
          privateKey: this.config.getOrThrow('REMINDERS_VAPID_PRIVATE_KEY'),
        },
        TTL: 300,
        timeout: 10000,
        topic: createHash('sha256')
          .update(payload.reminderId)
          .digest('base64url')
          .slice(0, 32),
      },
    );
  }
  async email(to: string, subject: string, text: string, messageId: string) {
    if (!this.emailConfigured())
      throw new Error('Reminder email is not enabled or configured');
    const secure = Number(this.config.get('SMTP_PORT', 587)) === 465;
    const transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: Number(this.config.get('SMTP_PORT', 587)),
      secure,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    try {
      await transporter.sendMail({
        from:
          this.config.get<string>('SMTP_FROM') ||
          this.config.get<string>('SMTP_USER'),
        to,
        subject,
        text,
        messageId: `<reminder-${messageId}@crm.meeautoparts.com>`,
      });
    } catch {
      throw new Error('SMTP delivery could not be confirmed');
    } finally {
      transporter.close();
    }
  }
}
