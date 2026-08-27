import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ShipmentStatus as PrismaShipmentStatus } from '@prisma/client';
import {
  buildCreatedAtFilter,
} from '../../common/utils/date-range.util';
import {
  createPaginatedResponse,
  getPaginationParams,
} from '../../common/utils/pagination.util';
import { handlePrismaError } from '../../common/utils/prisma-exception.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { QueryShipmentsDto } from './dto/query-shipments.dto';

const shipmentSummarySelect = {
  id: true,
  bolNumber: true,
  proNumber: true,
  carrierName: true,
  status: true,
  orderId: true,
  shippedAt: true,
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      totalSaleAmount: true,
      currency: true,
      intakeDetails: true,
      createdAt: true,
    },
  },
  costs: {
    take: 1,
    select: {
      id: true,
      shipmentId: true,
      purchaseAmount: true,
      shippingAmount: true,
      additionalAmount: true,
      grossProfit: true,
      currency: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  additionalCosts: {
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      shipmentId: true,
      amount: true,
      reason: true,
      createdAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  },
  _count: {
    select: {
      costs: true,
      events: true,
      notes: true,
    },
  },
} satisfies Prisma.ShipmentSelect;

const shipmentDetailSelect = {
  ...shipmentSummarySelect,
} satisfies Prisma.ShipmentSelect;

const OPERATIONAL_SHIPMENT_STATUSES = [
  PrismaShipmentStatus.SHIPPED,
  PrismaShipmentStatus.IN_TRANSIT,
  PrismaShipmentStatus.DELAYED,
  PrismaShipmentStatus.DELIVERED,
  PrismaShipmentStatus.CANCELLED,
] satisfies PrismaShipmentStatus[];

@Injectable()
export class ShipmentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createShipmentDto: CreateShipmentDto) {
    const status = (createShipmentDto.status ??
      PrismaShipmentStatus.PENDING) as PrismaShipmentStatus;

    try {
      return await this.prismaService.shipment.create({
        data: {
          bolNumber: createShipmentDto.bolNumber?.trim(),
          order: {
            connect: {
              id: createShipmentDto.orderId,
            },
          },
          carrierName: createShipmentDto.carrierName?.trim(),
          status,
          shippedAt:
            status === PrismaShipmentStatus.SHIPPED ? new Date() : undefined,
        },
        select: shipmentSummarySelect,
      });
    } catch (error) {
      handlePrismaError(error, 'Shipment');
    }
  }

  async findAll(queryShipmentsDto: QueryShipmentsDto) {
    const { page, limit, skip } = getPaginationParams(
      queryShipmentsDto.page,
      queryShipmentsDto.limit,
    );
    const search = queryShipmentsDto.search?.trim();
    const where: Prisma.ShipmentWhereInput = {};

    if (queryShipmentsDto.status) {
      where.status = (
        OPERATIONAL_SHIPMENT_STATUSES as readonly PrismaShipmentStatus[]
      ).includes(queryShipmentsDto.status as PrismaShipmentStatus)
        ? queryShipmentsDto.status
        : { in: [] };
    } else {
      where.status = {
        in: OPERATIONAL_SHIPMENT_STATUSES,
      };
    }

    const createdAtFilter = buildCreatedAtFilter(
      queryShipmentsDto.createdFrom,
      queryShipmentsDto.createdTo,
    );

    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    if (search) {
      where.OR = [
        {
          bolNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          proNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          carrierName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          order: {
            orderNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          order: {
            customerName: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const [data, total] = await this.prismaService.$transaction([
      this.prismaService.shipment.findMany({
        where,
        select: shipmentSummarySelect,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prismaService.shipment.count({ where }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const shipment = await this.prismaService.shipment.findUnique({
      where: { id },
      select: shipmentDetailSelect,
    });

    if (!shipment) {
      throw new NotFoundException('Shipment was not found.');
    }

    return shipment;
  }

  async updateStatus(
    id: string,
    statusUpdate: {
      status: PrismaShipmentStatus;
      bolNumber?: string;
      proNumber?: string;
      carrierName?: string;
      shippedAt?: Date;
      deliveredAt?: Date;
    },
  ) {
    const data: Prisma.ShipmentUpdateInput = {
      status: statusUpdate.status,
    };

    if (statusUpdate.shippedAt) {
      data.shippedAt = statusUpdate.shippedAt;
    }

    if (statusUpdate.bolNumber) {
      data.bolNumber = statusUpdate.bolNumber.trim();
    }

    if (statusUpdate.proNumber) {
      data.proNumber = statusUpdate.proNumber.trim();
    }

    if (statusUpdate.carrierName !== undefined) {
      data.carrierName = statusUpdate.carrierName?.trim();
    }

    if (statusUpdate.deliveredAt) {
      data.deliveredAt = statusUpdate.deliveredAt;
    }

    try {
      return await this.prismaService.shipment.update({
        where: { id },
        data,
        select: shipmentSummarySelect,
      });
    } catch (error) {
      handlePrismaError(error, 'Shipment');
    }
  }
}
