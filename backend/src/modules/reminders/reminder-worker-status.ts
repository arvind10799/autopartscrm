import { ConfigService } from '@nestjs/config';

export const REMINDER_WORKER_HEARTBEAT = 'reminders:worker:heartbeat';
export type ReminderWorkerHeartbeat = {
  checkedAt: string;
  pushConfigured: boolean;
  emailConfigured: boolean;
  emailEnabled: boolean;
};

export function reminderChannelSettings(config: ConfigService) {
  return {
    pushConfigured: Boolean(
      config.get('REMINDERS_VAPID_PUBLIC_KEY') &&
      config.get('REMINDERS_VAPID_PRIVATE_KEY') &&
      config.get('REMINDERS_VAPID_SUBJECT'),
    ),
    emailConfigured: Boolean(
      config.get('SMTP_HOST') &&
      config.get('SMTP_USER') &&
      config.get('SMTP_PASS'),
    ),
    emailEnabled: config.get('REMINDERS_EMAIL_ENABLED') === 'true',
  };
}
