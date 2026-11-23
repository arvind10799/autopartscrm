import { Role } from '../../common/enums/role.enum';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import type { NotificationCategory } from './dto/notification-category.dto';

describe('notification category isolation', () => {
  const user = {
    userId: 'recipient',
    name: 'Agent',
    email: 'agent@example.test',
    role: Role.SALES,
  };
  const notification = {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    groupBy: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
  };
  const service = new NotificationsService({
    notification,
  } as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it.each<NotificationCategory>(['GENERAL', 'REMINDERS'])(
    'scopes bulk and grouped read/clear operations to %s',
    async (category) => {
      const categoryWhere =
        category === 'REMINDERS'
          ? { type: { startsWith: 'REMINDER_' } }
          : { NOT: { type: { startsWith: 'REMINDER_' } } };
      await service.markAllRead(user, category);
      await service.clearAll(user, category);
      expect(notification.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            recipientUserId: user.userId,
            clearedAt: null,
            isRead: false,
            ...categoryWhere,
          }),
        }),
      );
      expect(notification.updateMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            recipientUserId: user.userId,
            clearedAt: null,
            ...categoryWhere,
          }),
        }),
      );
      const group = {
        entityType: 'ORDER',
        entityId: 'shared-record',
        category,
      };
      await service.markGroupRead(group, user);
      await service.clearGroup(group, user);
      for (const call of [3, 4])
        expect(notification.updateMany).toHaveBeenNthCalledWith(
          call,
          expect.objectContaining({
            where: expect.objectContaining({
              recipientUserId: user.userId,
              entityType: group.entityType,
              entityId: group.entityId,
              ...categoryWhere,
            }),
          }),
        );
    },
  );

  it('preserves bulk operations for existing callers without a category', async () => {
    await service.markAllRead(user);
    await service.clearAll(user);
    for (const [args] of notification.updateMany.mock.calls) {
      expect(args.where).not.toHaveProperty('type');
      expect(args.where).not.toHaveProperty('NOT');
      expect(args.where.recipientUserId).toBe(user.userId);
    }
  });

  it('returns both badges and the legacy total from one grouped count query', async () => {
    notification.groupBy.mockResolvedValue([
      { type: 'ORDER_CREATED', _count: { _all: 3 } },
      { type: 'SHIPMENT_UPDATED', _count: { _all: 2 } },
      { type: 'REMINDER_DUE', _count: { _all: 4 } },
      { type: 'REMINDER_REASSIGNED', _count: { _all: 1 } },
    ]);
    expect(await service.getUnreadCount(user)).toEqual({
      count: 10,
      notificationCount: 5,
      reminderCount: 5,
      latestReminder: null,
    });
    expect(notification.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          recipientUserId: user.userId,
          clearedAt: null,
          isRead: false,
        }),
      }),
    );
  });
});
