import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { handlePrismaError } from '../../common/utils/prisma-exception.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateShipmentEventDto } from './dto/create-shipment-event.dto';

const shipmentEventSelect = {
  id: true,
  shipmentId: true,
  eventType: true,
  description: true,
  location: true,
  eventAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ShipmentEventSelect;

const shipmentTimelineSelect = {
  id: true,
  bolNumber: true,
  proNumber: true,
  carrierName: true,
  status: true,
  orderId: true,
} satisfies Prisma.ShipmentSelect;

@Injectable()
export class TrackingRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async existsShipmentById(shipmentId: string): Promise<boolean> {
    const shipment = await this.prismaService.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
      },
    });

    return Boolean(shipment);
  }

  async create(createShipmentEventDto: CreateShipmentEventDto) {
    try {
      return await this.prismaService.shipmentEvent.create({
        data: {
          shipment: {
            connect: {
              id: createShipmentEventDto.shipmentId,
            },
          },
          eventType: createShipmentEventDto.eventType.trim(),
          description: createShipmentEventDto.description?.trim(),
          location: createShipmentEventDto.location?.trim(),
        },
        select: shipmentEventSelect,
      });
    } catch (error) {
      handlePrismaError(error, 'Shipment event');
    }
  }

  async findTimelineByShipmentId(shipmentId: string) {
    const shipment = await this.prismaService.shipment.findUnique({
      where: { id: shipmentId },
      select: shipmentTimelineSelect,
    });

    if (!shipment) {
      throw new NotFoundException('Shipment was not found.');
    }

    const events = await this.prismaService.shipmentEvent.findMany({
      where: { shipmentId },
      select: shipmentEventSelect,
      orderBy: [
        {
          eventAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    return {
      shipment,
      events,
    };
  }
}
