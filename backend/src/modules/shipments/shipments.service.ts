import { BadRequestException, Injectable } from '@nestjs/common';
import { ShipmentStatus as PrismaShipmentStatus } from '@prisma/client';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CACHE_NAMESPACE_ORDERS_LIST } from '../../infrastructure/redis/redis.constants';
import { RedisCacheService } from '../../infrastructure/redis/redis-cache.service';
import { NotesService } from '../notes/notes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { QueryShipmentsDto } from './dto/query-shipments.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ShipmentsRepository } from './shipments.repository';

const ALLOWED_STATUS_TRANSITIONS: Record<
  PrismaShipmentStatus,
  PrismaShipmentStatus[]
> = {
  [PrismaShipmentStatus.PENDING]: [
    PrismaShipmentStatus.LOCATING,
    PrismaShipmentStatus.CANCELLED,
  ],
  [PrismaShipmentStatus.LOCATING]: [
    PrismaShipmentStatus.PRE_PROCESSING,
    PrismaShipmentStatus.CANCELLED,
  ],
  [PrismaShipmentStatus.PRE_PROCESSING]: [
    PrismaShipmentStatus.PURCHASE,
    PrismaShipmentStatus.CANCELLED,
  ],
  [PrismaShipmentStatus.PURCHASE]: [
    PrismaShipmentStatus.SHIPPED,
    PrismaShipmentStatus.CANCELLED,
  ],
  [PrismaShipmentStatus.SHIPPED]: [
    PrismaShipmentStatus.IN_TRANSIT,
    PrismaShipmentStatus.DELAYED,
    PrismaShipmentStatus.DELIVERED,
    PrismaShipmentStatus.CANCELLED,
  ],
  [PrismaShipmentStatus.IN_TRANSIT]: [
    PrismaShipmentStatus.DELAYED,
    PrismaShipmentStatus.DELIVERED,
    PrismaShipmentStatus.CANCELLED,
  ],
  [PrismaShipmentStatus.DELAYED]: [
    PrismaShipmentStatus.SHIPPED,
    PrismaShipmentStatus.IN_TRANSIT,
    PrismaShipmentStatus.CANCELLED,
  ],
  [PrismaShipmentStatus.DELIVERED]: [],
  [PrismaShipmentStatus.CANCELLED]: [],
};

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly shipmentsRepository: ShipmentsRepository,
    private readonly prismaService: PrismaService,
    private readonly redisCacheService: RedisCacheService,
    private readonly notificationsService: NotificationsService,
    private readonly notesService: NotesService,
  ) {}

  async create(createShipmentDto: CreateShipmentDto, user: AuthenticatedUser) {
    await this.ensureOrderCanCreateShipment(createShipmentDto.orderId);

    const shipment = await this.shipmentsRepository.create(createShipmentDto);
    await this.addOrderStatusHistoryNote(
      createShipmentDto.orderId,
      user,
      `Shipment status updated:\nStatus: ${formatShipmentStatusLabel(
        shipment.status,
      )}\nShipment: ${shipment.bolNumber ?? 'BOL pending'}`,
    );

    await this.redisCacheService.bumpNamespaceVersion(
      CACHE_NAMESPACE_ORDERS_LIST,
    );
    await this.notificationsService.notifyShipmentCreated(shipment.id);

    return shipment;
  }

  findAll(queryShipmentsDto: QueryShipmentsDto) {
    return this.shipmentsRepository.findAll(queryShipmentsDto);
  }

  findOne(id: string) {
    return this.shipmentsRepository.findOne(id);
  }

  async updateStatus(
    id: string,
    updateShipmentStatusDto: UpdateShipmentStatusDto,
    user: AuthenticatedUser,
  ) {
    const existingShipment = await this.shipmentsRepository.findOne(id);
    const currentStatus = existingShipment.status;
    const nextStatus = updateShipmentStatusDto.status as PrismaShipmentStatus;

    if (currentStatus === nextStatus) {
      throw new BadRequestException(
        `Shipment is already in ${nextStatus} status.`,
      );
    }

    this.ensureStatusTransitionAllowed(
      currentStatus,
      nextStatus,
      Boolean(existingShipment.shippedAt),
    );
    this.ensureBolNumberForShipped(
      nextStatus,
      existingShipment.bolNumber,
      updateShipmentStatusDto.bolNumber,
    );
    this.ensureProNumberForInTransit(
      nextStatus,
      existingShipment.proNumber,
      updateShipmentStatusDto.proNumber,
    );

    const shipment = await this.shipmentsRepository.updateStatus(id, {
      status: nextStatus,
      bolNumber:
        nextStatus === PrismaShipmentStatus.SHIPPED &&
        !existingShipment.bolNumber
          ? updateShipmentStatusDto.bolNumber
          : undefined,
      proNumber:
        nextStatus === PrismaShipmentStatus.IN_TRANSIT &&
        !existingShipment.proNumber
          ? updateShipmentStatusDto.proNumber
          : undefined,
      carrierName:
        nextStatus === PrismaShipmentStatus.SHIPPED
          ? updateShipmentStatusDto.carrierName
          : undefined,
      shippedAt:
        (nextStatus === PrismaShipmentStatus.SHIPPED ||
          nextStatus === PrismaShipmentStatus.IN_TRANSIT) &&
        !existingShipment.shippedAt
          ? new Date()
          : undefined,
      deliveredAt:
        nextStatus === PrismaShipmentStatus.DELIVERED ? new Date() : undefined,
    });
    await this.addOrderStatusHistoryNote(
      shipment.orderId,
      user,
      `Shipment status updated:\nStatus: ${formatShipmentStatusLabel(
        currentStatus,
      )} -> ${formatShipmentStatusLabel(nextStatus)}\nShipment: ${
        shipment.bolNumber ?? 'BOL pending'
      }${shipment.proNumber ? `\nPRO: ${shipment.proNumber}` : ''}`,
    );
    await this.notificationsService.notifyShipmentStatusUpdated(
      id,
      currentStatus,
      nextStatus,
    );

    return shipment;
  }

  private async ensureOrderCanCreateShipment(orderId: string): Promise<void> {
    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        _count: {
          select: {
            shipments: true,
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('The specified order does not exist.');
    }

    if (order._count.shipments > 0) {
      throw new BadRequestException(
        'A shipment has already been created for this order.',
      );
    }
  }

  private ensureStatusTransitionAllowed(
    currentStatus: PrismaShipmentStatus,
    nextStatus: PrismaShipmentStatus,
    hasShippedAt: boolean,
  ): void {
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus];

    if (!allowedTransitions.includes(nextStatus)) {
      throw new BadRequestException(
        `Shipment status cannot transition from ${currentStatus} to ${nextStatus}.`,
      );
    }

    if (nextStatus === PrismaShipmentStatus.DELIVERED && !hasShippedAt) {
      throw new BadRequestException(
        'Shipment cannot be marked as delivered before it has shipped.',
      );
    }
  }

  private ensureProNumberForInTransit(
    nextStatus: PrismaShipmentStatus,
    existingProNumber: string | null,
    nextProNumber?: string,
  ): void {
    if (nextStatus !== PrismaShipmentStatus.IN_TRANSIT || existingProNumber) {
      return;
    }

    if (!nextProNumber) {
      throw new BadRequestException(
        'PRO number is required when moving shipment to in transit.',
      );
    }
  }

  private ensureBolNumberForShipped(
    nextStatus: PrismaShipmentStatus,
    existingBolNumber: string | null,
    nextBolNumber?: string,
  ): void {
    if (nextStatus !== PrismaShipmentStatus.SHIPPED || existingBolNumber) {
      return;
    }

    if (!nextBolNumber) {
      throw new BadRequestException(
        'BOL number is required when moving shipment to shipped.',
      );
    }
  }

  private async addOrderStatusHistoryNote(
    orderId: string,
    user: AuthenticatedUser,
    content: string,
  ) {
    await this.notesService.create(
      {
        content,
        entityId: orderId,
        entityType: NoteEntityType.ORDER,
      },
      user,
    );
  }
}

function formatShipmentStatusLabel(status: PrismaShipmentStatus): string {
  const statusLabels: Record<PrismaShipmentStatus, string> = {
    [PrismaShipmentStatus.PENDING]: 'Pending',
    [PrismaShipmentStatus.LOCATING]: 'Locating',
    [PrismaShipmentStatus.PRE_PROCESSING]: 'Pre Processing',
    [PrismaShipmentStatus.PURCHASE]: 'Purchase',
    [PrismaShipmentStatus.SHIPPED]: 'Shipped',
    [PrismaShipmentStatus.IN_TRANSIT]: 'In Transit',
    [PrismaShipmentStatus.DELAYED]: 'Delayed',
    [PrismaShipmentStatus.DELIVERED]: 'Delivered',
    [PrismaShipmentStatus.CANCELLED]: 'Cancelled',
  };

  return statusLabels[status];
}
