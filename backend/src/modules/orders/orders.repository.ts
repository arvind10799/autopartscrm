import { Injectable, NotFoundException } from '@nestjs/common';
import {
  OrderStatus as PrismaOrderStatus,
  Prisma,
} from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { buildCreatedAtFilter } from '../../common/utils/date-range.util';
import {
  createPaginatedResponse,
  getPaginationParams,
} from '../../common/utils/pagination.util';
import { handlePrismaError } from '../../common/utils/prisma-exception.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

type CreateOrderPayload = CreateOrderDto & {
  totalSaleAmount: Prisma.Decimal;
};

type UpdateOrderPayload = Omit<UpdateOrderDto, 'note'> & {
  totalSaleAmount?: Prisma.Decimal;
};

const orderListSelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  partDescription: true,
  customerEmail: true,
  customerPhone: true,
  price: true,
  quantity: true,
  totalSaleAmount: true,
  status: true,
  paymentMethod: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  shipments: {
    take: 1,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  notes: {
    take: 1,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      author: {
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
      shipments: true,
      notes: true,
    },
  },
} satisfies Prisma.OrderSelect;

const orderDetailInclude = {
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  shipments: {
    orderBy: {
      createdAt: 'desc',
    },
  },
  notes: {
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  },
  _count: {
    select: {
      shipments: true,
      notes: true,
    },
  },
} satisfies Prisma.OrderInclude;

const orderEditableSelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  partDescription: true,
  customerEmail: true,
  customerPhone: true,
  price: true,
  quantity: true,
  status: true,
  paymentMethod: true,
} satisfies Prisma.OrderSelect;

@Injectable()
export class OrdersRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createOrderDto: CreateOrderPayload, createdById: string) {
    return this.createWithClient(this.prismaService, createOrderDto, createdById);
  }

  async createWithTransaction(
    transactionClient: Prisma.TransactionClient,
    createOrderDto: CreateOrderPayload,
    createdById: string,
  ) {
    return this.createWithClient(transactionClient, createOrderDto, createdById);
  }

  private async createWithClient(
    client: Prisma.TransactionClient | PrismaService,
    createOrderDto: CreateOrderPayload,
    createdById: string,
  ) {
    try {
      return await client.order.create({
        data: {
          orderNumber: createOrderDto.orderNumber.trim(),
          customerName: createOrderDto.customerName.trim(),
          partDescription: createOrderDto.partDescription.trim(),
          customerEmail: createOrderDto.customerEmail?.trim().toLowerCase(),
          customerPhone: createOrderDto.customerPhone?.trim(),
          intakeDetails: this.buildIntakeDetailsPayload(createOrderDto),
          price: createOrderDto.price,

          quantity: createOrderDto.quantity,
          totalSaleAmount: createOrderDto.totalSaleAmount,
          status: createOrderDto.status ?? PrismaOrderStatus.DRAFT,
          paymentMethod: createOrderDto.paymentMethod,
          createdBy: {
            connect: {
              id: createdById,
            },
          },
        },
        select: orderListSelect,
      });
    } catch (error) {
      handlePrismaError(error, 'Order');
    }
  }

  async findAll(
    queryOrdersDto: QueryOrdersDto,
    user: AuthenticatedUser,
  ) {
    const { page, limit, skip } = getPaginationParams(
      queryOrdersDto.page,
      queryOrdersDto.limit,
    );

    const where: Prisma.OrderWhereInput = this.buildOrderAccessWhere(user);
    const orderNumber = queryOrdersDto.orderNumber?.trim();
    const search = queryOrdersDto.search?.trim();

    if (orderNumber) {
      where.orderNumber = {
        contains: orderNumber,
        mode: 'insensitive',
      };
    }

    if (queryOrdersDto.status) {
      where.status = queryOrdersDto.status;
    }

    const hasShipmentFilter = this.normalizeHasShipmentFilter(
      queryOrdersDto.hasShipment,
    );

    if (hasShipmentFilter !== undefined) {
      where.shipments = hasShipmentFilter ? { some: {} } : { none: {} };
    }

    const createdAtFilter = buildCreatedAtFilter(
      queryOrdersDto.createdFrom,
      queryOrdersDto.createdTo,
    );

    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    if (search) {
      where.OR = [
        {
          orderNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          customerName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          partDescription: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          customerEmail: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          createdBy: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          createdBy: {
            email: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const [data, total] = await this.prismaService.$transaction([
      this.prismaService.order.findMany({
        where,
        select: orderListSelect,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prismaService.order.count({ where }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const order = await this.prismaService.order.findFirst({
      where: {
        id,
        ...this.buildOrderAccessWhere(user),
      },
      include: orderDetailInclude,
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    return order;
  }

  async findEditableById(id: string, user: AuthenticatedUser) {
    const order = await this.prismaService.order.findFirst({
      where: {
        id,
        ...this.buildOrderAccessWhere(user),
      },
      select: orderEditableSelect,
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    return order;
  }

  async findSummaryById(id: string, user: AuthenticatedUser) {
    const order = await this.prismaService.order.findFirst({
      where: {
        id,
        ...this.buildOrderAccessWhere(user),
      },
      select: orderListSelect,
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderPayload) {
    const data: Prisma.OrderUncheckedUpdateInput = {};

    if (updateOrderDto.customerEmail !== undefined) {
      data.customerEmail = updateOrderDto.customerEmail.trim().toLowerCase();
    }

    if (updateOrderDto.customerPhone !== undefined) {
      data.customerPhone = updateOrderDto.customerPhone.trim();
    }

    if (updateOrderDto.quantity !== undefined) {
      data.quantity = updateOrderDto.quantity;
    }

    if (updateOrderDto.totalSaleAmount !== undefined) {
      data.totalSaleAmount = updateOrderDto.totalSaleAmount;
    }

    try {
      return await this.prismaService.order.update({
        where: { id },
        data,
        select: orderListSelect,
      });
    } catch (error) {
      handlePrismaError(error, 'Order');
    }
  }

  private buildOrderAccessWhere(
    user: AuthenticatedUser,
  ): Prisma.OrderWhereInput {
    if (user.role === Role.SALES) {
      return {
        createdById: user.userId,
      };
    }

    return {};
  }

  private normalizeHasShipmentFilter(value: unknown): boolean | undefined {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return undefined;
  }

  private buildIntakeDetailsPayload(createOrderDto: CreateOrderPayload) {
    return {
      orderDate: createOrderDto.orderDate,
      vehicleMake: createOrderDto.vehicleMake ?? null,
      vehicleModel: createOrderDto.vehicleModel ?? null,
      vehicleYear: createOrderDto.vehicleYear ?? null,
      vehicleVariant: createOrderDto.vehicleVariant ?? null,
      vehicleVin: createOrderDto.vehicleVin ?? null,
      vehicleNotes: createOrderDto.vehicleNotes ?? null,
      vehicleConfiguration: createOrderDto.vehicleConfiguration ?? null,
      billingAddress: createOrderDto.billingAddress ?? null,
      billingPerson: createOrderDto.billingPerson ?? null,
      billingPhone: createOrderDto.billingPhone ?? null,
      shippingAddress: createOrderDto.shippingAddress ?? null,
      shippingPerson: createOrderDto.shippingPerson ?? null,
      shippingPhone: createOrderDto.shippingPhone ?? null,
      shippingAt: createOrderDto.shippingAt ?? null,
      companyName: createOrderDto.companyName ?? null,
      milesOffered: createOrderDto.milesOffered ?? null,
      basePrice: createOrderDto.basePrice ?? null,
      salesTax: createOrderDto.salesTax ?? null,
      shippingCharges: createOrderDto.shippingCharges ?? null,
      profit: createOrderDto.profit ?? null,
      partialPayment: createOrderDto.partialPayment ?? null,
    };
  }
}
