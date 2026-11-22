import { ReminderNotificationService } from './reminder-notification.service';
import { ReminderDeliveryService } from './reminder-delivery.service';
import { REMINDER_WORKER_HEARTBEAT } from './reminder-worker-status';

describe('Reminder worker check-ins', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reports successful polls, throttles check-ins and reports a stale worker separately from API settings', async () => {
    const entries = new Map<string, unknown>();
    const cache = {
      get: (key: string) => entries.get(key) ?? null,
      set: jest.fn(async (key: string, value: unknown) => {
        entries.set(key, value);
      }),
    };
    const workerConfig = { get: () => 'true' };
    const worker = new ReminderDeliveryService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      workerConfig as never,
      cache as never,
    );
    jest.spyOn(worker, 'tick').mockResolvedValue();
    const api = new ReminderNotificationService(
      {
        reminderSettings: {
          findUniqueOrThrow: () => ({ deliveryEnabled: true }),
        },
        reminderDelivery: { count: () => 0 },
      } as never,
      { assertActiveActor: () => true } as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => undefined } as never,
      cache as never,
    );
    const admin = { role: 'ADMIN' } as never;
    worker.onModuleInit();
    await jest.advanceTimersByTimeAsync(10000);
    expect(cache.set).toHaveBeenCalledTimes(1);
    const first = await api.settings(admin);
    expect(first).toMatchObject({
      serverEnabled: false,
      workerRecent: true,
      emailEnabled: true,
      pushConfigured: true,
    });
    expect(entries.has(REMINDER_WORKER_HEARTBEAT)).toBe(true);
    await worker.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(121000);
    expect(await api.settings(admin)).toMatchObject({
      workerRecent: false,
      workerLastSeenAt: first.workerLastSeenAt,
      emailEnabled: false,
      pushConfigured: false,
    });
  });
});
