import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ReplacementStatus as PrismaReplacementStatus,
  ShipmentStatus as PrismaShipmentStatus,
} from '@prisma/client';
import { buildCreatedAtFilter } from '../../common/utils/date-range.util';
import {
  createPaginatedResponse,
  getPaginationParams,
} from '../../common/utils/pagination.util';
import { handlePrismaError } from '../../common/utils/prisma-exception.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { QueryReplacementsDto } from './dto/query-replacements.dto';

const replacementUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

const replacementInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      salesNumber: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      partDescription: true,
      totalSaleAmount: true,
      currency: true,
      status: true,
      createdAt: true,
      intakeDetails: true,
    },
  },
  shipment: {
    select: {
      id: true,
      bolNumber: true,
      pickupNumber: true,
      proNumber: true,
      carrierName: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  createdBy: {
    select: replacementUserSelect,
  },
  updatedBy: {
    select: replacementUserSelect,
  },
  histories: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
    include: {
      createdBy: {
        select: replacementUserSelect,
      },
    },
  },
} satisfies Prisma.ReplacementRequestInclude;

@Injectable()
export class ReplacementsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async orderExists(orderId: string) {
    const order = await this.prismaService.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });

    return Boolean(order);
  }

  async shipmentBelongsToOrder(shipmentId: string, orderId: string) {
    const shipment = await this.prismaService.shipment.findFirst({
      where: { id: shipmentId, orderId },
      select: { id: true },
    });

    return Boolean(shipment);
  }

  async create(
    data: {
      orderId: string;
      shipmentId?: string | null;
      customerReason: string;
      yardUpdate?: string | null;
      replacementStatus: PrismaReplacementStatus;
      replacementProNumber?: string | null;
      replacementCarrierName?: string | null;
      createdById: string;
    },
  ) {
    try {
      return await this.prismaService.replacementRequest.create({
        data: {
          orderId: data.orderId,
          shipmentId: data.shipmentId ?? null,
          customerReason: data.customerReason,
          yardUpdate: data.yardUpdate ?? null,
          replacementStatus: data.replacementStatus,
          replacementProNumber: data.replacementProNumber ?? null,
          replacementCarrierName: data.replacementCarrierName ?? null,
          createdById: data.createdById,
          updatedById: data.createdById,
          histories: {
            create: {
              action: 'CREATED',
              summary: `Replacement request created with status ${data.replacementStatus}.`,
              nextStatus: data.replacementStatus,
              customerReason: data.customerReason,
              yardUpdate: data.yardUpdate ?? null,
              replacementProNumber: data.replacementProNumber ?? null,
              replacementCarrierName: data.replacementCarrierName ?? null,
              createdById: data.createdById,
            },
          },
        },
        include: replacementInclude,
      });
    } catch (error) {
      handlePrismaError(error, 'replacement request');
    }
  }

  async findAll(query: QueryReplacementsDto) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);
    const where = this.buildWhere(query);
    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.replacementRequest.findMany({
        where,
        include: replacementInclude,
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prismaService.replacementRequest.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, limit);
  }

  async findOne(id: string) {
    const replacement = await this.prismaService.replacementRequest.findUnique({
      where: { id },
      include: replacementInclude,
    });

    if (!replacement) {
      throw new NotFoundException('Replacement request was not found.');
    }

    return replacement;
  }

  async update(
    id: string,
    data: {
      customerReason?: string;
      yardUpdate?: string | null;
      replacementStatus?: PrismaReplacementStatus;
      replacementProNumber?: string | null;
      replacementCarrierName?: string | null;
      updatedById: string;
      history: {
        action: string;
        summary: string;
        previousStatus?: PrismaReplacementStatus;
        nextStatus?: PrismaReplacementStatus;
        customerReason?: string | null;
        yardUpdate?: string | null;
        replacementProNumber?: string | null;
        replacementCarrierName?: string | null;
      };
    },
  ) {
    try {
      return await this.prismaService.replacementRequest.update({
        where: { id },
        data: {
          ...(data.customerReason !== undefined
            ? { customerReason: data.customerReason }
            : {}),
          ...(data.yardUpdate !== undefined ? { yardUpdate: data.yardUpdate } : {}),
          ...(data.replacementStatus
            ? { replacementStatus: data.replacementStatus }
            : {}),
          ...(data.replacementProNumber !== undefined
            ? { replacementProNumber: data.replacementProNumber }
            : {}),
          ...(data.replacementCarrierName !== undefined
            ? { replacementCarrierName: data.replacementCarrierName }
            : {}),
          updatedById: data.updatedById,
          histories: {
            create: {
              action: data.history.action,
              summary: data.history.summary,
              previousStatus: data.history.previousStatus,
              nextStatus: data.history.nextStatus,
              customerReason: data.history.customerReason,
              yardUpdate: data.history.yardUpdate,
              replacementProNumber: data.history.replacementProNumber,
              replacementCarrierName: data.history.replacementCarrierName,
              createdById: data.updatedById,
            },
          },
        },
        include: replacementInclude,
      });
    } catch (error) {
      handlePrismaError(error, 'replacement request');
    }
  }

  private buildWhere(query: QueryReplacementsDto): Prisma.ReplacementRequestWhereInput {
    const createdAtFilter = buildCreatedAtFilter(query.createdFrom, query.createdTo);
    const trimmedSearch = query.search?.trim();
    const filters: Prisma.ReplacementRequestWhereInput[] = [];

    if (query.status) {
      filters.push({ replacementStatus: query.status });
    }

    if (query.orderId) {
      filters.push({ orderId: query.orderId });
    }

    if (query.shipmentId) {
      filters.push({ shipmentId: query.shipmentId });
    }

    if (query.shipmentStatus) {
      filters.push(
        query.shipmentStatus === PrismaShipmentStatus.PENDING
          ? {
              OR: [
                { shipmentId: null },
                { shipment: { status: PrismaShipmentStatus.PENDING } },
              ],
            }
          : { shipment: { status: query.shipmentStatus } },
      );
    }

    if (createdAtFilter) {
      filters.push({ createdAt: createdAtFilter });
    }

    if (trimmedSearch) {
      filters.push({
        OR: [
          { customerReason: { contains: trimmedSearch, mode: 'insensitive' } },
          { yardUpdate: { contains: trimmedSearch, mode: 'insensitive' } },
          {
            replacementProNumber: {
              contains: trimmedSearch,
              mode: 'insensitive',
            },
          },
          {
            replacementCarrierName: {
              contains: trimmedSearch,
              mode: 'insensitive',
            },
          },
          {
            order: {
              orderNumber: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
          {
            order: {
              salesNumber: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
          {
            order: {
              customerName: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
          {
            order: {
              customerPhone: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
          {
            order: {
              partDescription: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
          {
            shipment: {
              bolNumber: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
          {
            shipment: {
              proNumber: { contains: trimmedSearch, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    return filters.length > 0 ? { AND: filters } : {};
  }
}
