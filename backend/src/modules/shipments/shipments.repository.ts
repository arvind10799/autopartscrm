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

@Injectable()
export class ShipmentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createShipmentDto: CreateShipmentDto) {
    try {
      return await this.prismaService.shipment.create({
        data: {
          bolNumber: createShipmentDto.bolNumber.trim(),
          order: {
            connect: {
              id: createShipmentDto.orderId,
            },
          },
          carrierName: createShipmentDto.carrierName?.trim(),
          status: PrismaShipmentStatus.PENDING,
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
      where.status = queryShipmentsDto.status;
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
      proNumber?: string;
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

    if (statusUpdate.proNumber) {
      data.proNumber = statusUpdate.proNumber.trim();
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
