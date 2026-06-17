import { BadRequestException, Injectable } from '@nestjs/common';
import { ShipmentStatus as PrismaShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CACHE_NAMESPACE_ORDERS_LIST } from '../../infrastructure/redis/redis.constants';
import { RedisCacheService } from '../../infrastructure/redis/redis-cache.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { QueryShipmentsDto } from './dto/query-shipments.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ShipmentsRepository } from './shipments.repository';

const ALLOWED_STATUS_TRANSITIONS: Record<
  PrismaShipmentStatus,
  PrismaShipmentStatus[]
> = {
  [PrismaShipmentStatus.PENDING]: [
    PrismaShipmentStatus.IN_TRANSIT,
    PrismaShipmentStatus.CANCELLED,
  ],
  [PrismaShipmentStatus.IN_TRANSIT]: [
    PrismaShipmentStatus.DELAYED,
    PrismaShipmentStatus.DELIVERED,
    PrismaShipmentStatus.CANCELLED,
  ],
  [PrismaShipmentStatus.DELAYED]: [
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
  ) {}

  async create(createShipmentDto: CreateShipmentDto) {
    await this.ensureOrderCanCreateShipment(createShipmentDto.orderId);

    const shipment = await this.shipmentsRepository.create(createShipmentDto);

    await this.redisCacheService.bumpNamespaceVersion(
      CACHE_NAMESPACE_ORDERS_LIST,
    );

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
    this.ensureProNumberForInTransit(
      nextStatus,
      existingShipment.proNumber,
      updateShipmentStatusDto.proNumber,
    );

    return this.shipmentsRepository.updateStatus(id, {
      status: nextStatus,
      proNumber:
        nextStatus === PrismaShipmentStatus.IN_TRANSIT &&
        !existingShipment.proNumber
          ? updateShipmentStatusDto.proNumber
          : undefined,
      shippedAt:
        nextStatus === PrismaShipmentStatus.IN_TRANSIT &&
        !existingShipment.shippedAt
          ? new Date()
          : undefined,
      deliveredAt:
        nextStatus === PrismaShipmentStatus.DELIVERED ? new Date() : undefined,
    });
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
}
