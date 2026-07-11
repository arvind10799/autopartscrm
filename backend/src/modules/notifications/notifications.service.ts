import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_TYPES,
} from './notifications.constants';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

type NotificationPayload = {
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prismaService: PrismaService) {}

  findForUser(user: AuthenticatedUser, query: QueryNotificationsDto) {
    return this.prismaService.notification.findMany({
      where: {
        recipientUserId: user.userId,
        clearedAt: null,
        ...(query.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 30,
    });
  }

  async getUnreadCount(user: AuthenticatedUser) {
    const count = await this.prismaService.notification.count({
      where: {
        recipientUserId: user.userId,
        clearedAt: null,
        isRead: false,
      },
    });

    return { count };
  }

  async markRead(id: string, user: AuthenticatedUser) {
    await this.prismaService.notification.updateMany({
      where: {
        id,
        recipientUserId: user.userId,
        clearedAt: null,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { id };
  }

  async markAllRead(user: AuthenticatedUser) {
    const result = await this.prismaService.notification.updateMany({
      where: {
        recipientUserId: user.userId,
        clearedAt: null,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  async clearOne(id: string, user: AuthenticatedUser) {
    await this.prismaService.notification.updateMany({
      where: {
        id,
        recipientUserId: user.userId,
        clearedAt: null,
      },
      data: {
        isRead: true,
        readAt: new Date(),
        clearedAt: new Date(),
      },
    });

    return { id };
  }

  async clearAll(user: AuthenticatedUser) {
    const now = new Date();
    const result = await this.prismaService.notification.updateMany({
      where: {
        recipientUserId: user.userId,
        clearedAt: null,
      },
      data: {
        isRead: true,
        readAt: now,
        clearedAt: now,
      },
    });

    return { count: result.count };
  }

  async notifyOrderCreated(orderId: string, actor: AuthenticatedUser) {
    const order = await this.findOrderNotificationContext(orderId);
    if (!order) return;

    const recipients = await this.findUserIdsByRoles([
      Role.ADMIN,
      Role.SHIPPING,
      Role.SALES,
    ]);

    await this.createForRecipients(recipients, {
      type: NOTIFICATION_TYPES.ORDER_CREATED,
      title: `New order ${order.orderNumber}`,
      message: `${actor.name} created order ${order.orderNumber} for ${order.customerName}.`,
      entityType: NOTIFICATION_ENTITY_TYPES.ORDER,
      entityId: order.id,
    });
  }

  async notifyOrderUpdated(orderId: string, actor: AuthenticatedUser) {
    const order = await this.findOrderNotificationContext(orderId);
    if (!order) return;

    const adminRecipients = await this.findUserIdsByRoles([Role.ADMIN]);

    await this.createForRecipients(adminRecipients, {
      type: NOTIFICATION_TYPES.ORDER_UPDATED,
      title: `Order updated ${order.orderNumber}`,
      message: `${actor.name} updated order ${order.orderNumber}.`,
      entityType: NOTIFICATION_ENTITY_TYPES.ORDER,
      entityId: order.id,
    });
  }

  async notifyShipmentCreated(shipmentId: string) {
    const shipment = await this.findShipmentNotificationContext(shipmentId);
    if (!shipment) return;

    const recipients = await this.findShipmentRecipients(shipment.order.createdById);

    await this.createForRecipients(recipients, {
      type: NOTIFICATION_TYPES.SHIPMENT_CREATED,
      title: `Shipment created for ${shipment.order.orderNumber}`,
      message: `Shipment ${shipment.bolNumber} was created for order ${shipment.order.orderNumber}.`,
      entityType: NOTIFICATION_ENTITY_TYPES.SHIPMENT,
      entityId: shipment.id,
    });
  }

  async notifyShipmentStatusUpdated(
    shipmentId: string,
    previousStatus: string,
    nextStatus: string,
  ) {
    const shipment = await this.findShipmentNotificationContext(shipmentId);
    if (!shipment) return;

    const recipients = await this.findShipmentRecipients(shipment.order.createdById);

    await this.createForRecipients(recipients, {
      type: NOTIFICATION_TYPES.SHIPMENT_STATUS_UPDATED,
      title: `Shipment status updated`,
      message: `Shipment ${shipment.bolNumber} for ${shipment.order.orderNumber} changed from ${previousStatus} to ${nextStatus}.`,
      entityType: NOTIFICATION_ENTITY_TYPES.SHIPMENT,
      entityId: shipment.id,
    });
  }

  async notifyShipmentActivity(shipmentId: string, message: string) {
    const shipment = await this.findShipmentNotificationContext(shipmentId);
    if (!shipment) return;

    const recipients = await this.findShipmentRecipients(shipment.order.createdById);

    await this.createForRecipients(recipients, {
      type: NOTIFICATION_TYPES.SHIPMENT_ACTIVITY,
      title: `Shipment update`,
      message: `${message} Shipment ${shipment.bolNumber} for order ${shipment.order.orderNumber}.`,
      entityType: NOTIFICATION_ENTITY_TYPES.SHIPMENT,
      entityId: shipment.id,
    });
  }

  async notifyNoteCreated(
    entityType: NoteEntityType,
    entityId: string,
    actor: AuthenticatedUser,
  ) {
    if (entityType === NoteEntityType.ORDER) {
      const order = await this.findOrderNotificationContext(entityId);
      if (!order) return;

      const recipients = await this.findOrderActivityRecipients(order.createdById);

      await this.createForRecipients(recipients, {
        type: NOTIFICATION_TYPES.ORDER_NOTE_CREATED,
        title: `Order note added`,
        message: `${actor.name} added a note on order ${order.orderNumber}.`,
        entityType: NOTIFICATION_ENTITY_TYPES.ORDER,
        entityId: order.id,
      });
      return;
    }

    if (entityType === NoteEntityType.SHIPMENT) {
      const shipment = await this.findShipmentNotificationContext(entityId);
      if (!shipment) return;

      const recipients = await this.findShipmentRecipients(
        shipment.order.createdById,
      );

      await this.createForRecipients(recipients, {
        type: NOTIFICATION_TYPES.SHIPMENT_NOTE_CREATED,
        title: `Shipment note added`,
        message: `${actor.name} added a note on shipment ${shipment.bolNumber}.`,
        entityType: NOTIFICATION_ENTITY_TYPES.SHIPMENT,
        entityId: shipment.id,
      });
    }
  }

  private async createForRecipients(
    recipientIds: string[],
    payload: NotificationPayload,
  ) {
    const uniqueRecipientIds = [...new Set(recipientIds)];

    if (uniqueRecipientIds.length === 0) {
      return;
    }

    await this.prismaService.notification.createMany({
      data: uniqueRecipientIds.map((recipientUserId) => ({
        recipientUserId,
        ...payload,
      })),
    });
  }

  private async findUserIdsByRoles(roles: Role[]) {
    const users = await this.prismaService.user.findMany({
      where: { role: { in: roles } },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  private async findOrderActivityRecipients(orderOwnerId: string) {
    const roleRecipients = await this.findUserIdsByRoles([
      Role.ADMIN,
      Role.SHIPPING,
    ]);

    return [...roleRecipients, orderOwnerId];
  }

  private async findShipmentRecipients(orderOwnerId: string) {
    return this.findOrderActivityRecipients(orderOwnerId);
  }

  private findOrderNotificationContext(orderId: string) {
    return this.prismaService.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        createdById: true,
      },
    });
  }

  private findShipmentNotificationContext(shipmentId: string) {
    return this.prismaService.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        bolNumber: true,
        status: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            createdById: true,
          },
        },
      },
    });
  }
}

