import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OrderStatus as PrismaOrderStatus,
  Prisma,
  ShipmentStatus as PrismaShipmentStatus,
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

type OrderResolutionUpdate = {
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  refundType?: string | null;
  refundDeductionAmount?: number | null;
  refundDeductionReason?: string | null;
  refundedAt?: string | null;
};

type CreateOrderPayload = CreateOrderDto & {
  totalSaleAmount: Prisma.Decimal;
};

type UpdateOrderPayload = Omit<UpdateOrderDto, 'note'> &
  OrderResolutionUpdate & {
  totalSaleAmount?: Prisma.Decimal;
};

const SHIPMENT_WORKFLOW_STATUSES = [
  PrismaShipmentStatus.PENDING,
  PrismaShipmentStatus.LOCATING,
  PrismaShipmentStatus.PRE_PROCESSING,
  PrismaShipmentStatus.PURCHASE,
] satisfies PrismaShipmentStatus[];
const PACIFIC_TIME_ZONE = 'America/Los_Angeles';
const ORDER_AGEING_RANGES = ['0-7', '8-14', '15-30', '31+'] as const;

type OrderAgeingRange = (typeof ORDER_AGEING_RANGES)[number];

const orderListSelect = {
  id: true,
  orderNumber: true,
  salesNumber: true,
  customerName: true,
  partDescription: true,
  customerEmail: true,
  customerPhone: true,
  price: true,
  quantity: true,
  totalSaleAmount: true,
  currency: true,
  status: true,
  paymentMethod: true,
  intakeDetails: true,
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
      bolNumber: true,
      pickupNumber: true,
      proNumber: true,
      carrierName: true,
      status: true,
      shippedAt: true,
      deliveredAt: true,
      createdAt: true,
      updatedAt: true,
      costs: {
        take: 1,
        select: {
          id: true,
          shipmentId: true,
          purchaseAmount: true,
          shippingAmount: true,
          estimatedPurchaseAmount: true,
          estimatedShippingAmount: true,
          hasActualPurchaseAmount: true,
          hasActualShippingAmount: true,
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
      costHistories: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 25,
        select: {
          id: true,
          shipmentId: true,
          action: true,
          summary: true,
          changes: true,
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
      replacementRequests: true,
    },
  },
} satisfies Prisma.OrderSelect;

export type OrderListRecord = Prisma.OrderGetPayload<{
  select: typeof orderListSelect;
}>;

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
    include: {
      costs: {
        take: 1,
        select: {
          id: true,
          shipmentId: true,
          purchaseAmount: true,
          shippingAmount: true,
          estimatedPurchaseAmount: true,
          estimatedShippingAmount: true,
          hasActualPurchaseAmount: true,
          hasActualShippingAmount: true,
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
      costHistories: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 25,
        select: {
          id: true,
          shipmentId: true,
          action: true,
          summary: true,
          changes: true,
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
  invoice: {
    select: {
      id: true,
      orderId: true,
      invoiceNumber: true,
      invoiceDate: true,
      salesAssistant: true,
      customerName: true,
      contactNumber: true,
      billingAddress: true,
      shippingAddress: true,
      shippingVendor: true,
      deliveryTimeline: true,
      itemDescription: true,
      vehiclePartDescription: true,
      warrantyPartsOnly: true,
      cancellationPolicy: true,
      quantity: true,
      saleAmount: true,
      paymentStatus: true,
      paymentDate: true,
      paymentSource: true,
      shippingCost: true,
      salesTaxes: true,
      coreCharge: true,
      totalAmount: true,
      customerSignature: true,
      signatureDate: true,
      photoIdRequired: true,
      photoIdFileName: true,
      photoIdMimeType: true,
      photoIdUploadedAt: true,
      signedAt: true,
      signatureIpAddress: true,
      signatureTokenExpiresAt: true,
      signatureRequestedAt: true,
      signatureLastSentAt: true,
      status: true,
      pdfStorageKey: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          auditEvents: true,
        },
      },
    },
  },
  _count: {
    select: {
      shipments: true,
      notes: true,
      replacementRequests: true,
    },
  },
} satisfies Prisma.OrderInclude;

const orderEditableSelect = {
  id: true,
  orderNumber: true,
  salesNumber: true,
  customerName: true,
  partDescription: true,
  customerEmail: true,
  customerPhone: true,
  price: true,
  quantity: true,
  totalSaleAmount: true,
  currency: true,
  status: true,
  paymentMethod: true,
  intakeDetails: true,
} satisfies Prisma.OrderSelect;

@Injectable()
export class OrdersRepository {
  private static readonly orderNumberPrefix = 'MAP';

  constructor(private readonly prismaService: PrismaService) {}

  async getNextOrderNumber(
    client: Prisma.TransactionClient | PrismaService = this.prismaService,
  ): Promise<string> {
    const dateSegment = this.buildOrderNumberDateSegment(new Date());
    const prefix = `${OrdersRepository.orderNumberPrefix}${dateSegment}`;
    const suffixStart = prefix.length + 1;
    const rows = await client.$queryRaw<Array<{ maxSuffix: number | bigint | null }>>(
      Prisma.sql`
        SELECT MAX(CAST(SUBSTRING("orderNumber" FROM ${suffixStart}::integer) AS INTEGER)) AS "maxSuffix"
        FROM "Order"
        WHERE "orderNumber" LIKE ${`${prefix}%`}
          AND SUBSTRING("orderNumber" FROM ${suffixStart}::integer) ~ '^[0-9]+$'
      `,
    );
    const currentMax = Number(rows[0]?.maxSuffix ?? 0);
    const nextSuffix = String(currentMax + 1).padStart(2, '0');

    return `${prefix}${nextSuffix}`;
  }

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
          salesNumber: createOrderDto.salesNumber?.trim(),
          customerName: createOrderDto.customerName.trim(),
          partDescription: createOrderDto.partDescription.trim(),
          customerEmail: createOrderDto.customerEmail?.trim().toLowerCase(),
          customerPhone: createOrderDto.customerPhone?.trim(),
          intakeDetails: this.buildIntakeDetailsPayload(createOrderDto),
          price: createOrderDto.price,

          quantity: createOrderDto.quantity,
          totalSaleAmount: createOrderDto.totalSaleAmount,
          currency: createOrderDto.currency ?? 'USD',
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
    const where = this.buildFindAllWhere(queryOrdersDto, user);

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

  findAllForExport(
    queryOrdersDto: QueryOrdersDto,
    user: AuthenticatedUser,
  ): Promise<OrderListRecord[]> {
    return this.prismaService.order.findMany({
      where: this.buildFindAllWhere(queryOrdersDto, user),
      select: orderListSelect,
      orderBy: {
        createdAt: 'desc',
      },
    });
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
        ...this.buildOrderAccessWhere(user, { restrictSalesToOwn: true }),
      },
      select: orderEditableSelect,
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    return order;
  }

  findOrderAgents() {
    return this.prismaService.user.findMany({
      where: {
        role: {
          in: [Role.ADMIN, Role.SALES],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: [
        {
          role: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    });
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

    if (updateOrderDto.customerName !== undefined) {
      data.customerName = updateOrderDto.customerName.trim();
    }

    if (updateOrderDto.partDescription !== undefined) {
      data.partDescription = updateOrderDto.partDescription.trim();
    }

    if (updateOrderDto.salesNumber !== undefined) {
      data.salesNumber = updateOrderDto.salesNumber?.trim() || null;
    }

    if (updateOrderDto.customerEmail !== undefined) {
      data.customerEmail = updateOrderDto.customerEmail.trim().toLowerCase();
    }

    if (updateOrderDto.customerPhone !== undefined) {
      data.customerPhone = updateOrderDto.customerPhone.trim();
    }

    if (updateOrderDto.quantity !== undefined) {
      data.quantity = updateOrderDto.quantity;
    }

    if (updateOrderDto.price !== undefined) {
      data.price = new Prisma.Decimal(updateOrderDto.price);
    }

    if (updateOrderDto.total !== undefined) {
      data.totalSaleAmount = new Prisma.Decimal(updateOrderDto.total);
    }

    if (updateOrderDto.currency !== undefined) {
      data.currency = updateOrderDto.currency;
    }

    if (updateOrderDto.status !== undefined) {
      data.status = updateOrderDto.status;
    }

    if (updateOrderDto.paymentMethod !== undefined) {
      data.paymentMethod = updateOrderDto.paymentMethod;
    }

    const intakeUpdates = this.buildIntakeDetailsUpdate(updateOrderDto);
    if (Object.keys(intakeUpdates).length > 0) {
      const existingOrder = await this.prismaService.order.findUnique({
        where: { id },
        select: { intakeDetails: true },
      });
      const currentIntake =
        existingOrder?.intakeDetails &&
        typeof existingOrder.intakeDetails === 'object' &&
        !Array.isArray(existingOrder.intakeDetails)
          ? (existingOrder.intakeDetails as Prisma.JsonObject)
          : {};
      data.intakeDetails = {
        ...currentIntake,
        ...intakeUpdates,
      };
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

  private buildIntakeDetailsUpdate(
    updateOrderDto: UpdateOrderPayload,
  ): Prisma.JsonObject {
    const intakeFields = [
      'advisorName',
      'orderDate',
      'vehicleMake',
      'vehicleModel',
      'vehicleYear',
      'vehicleVariant',
      'vehicleVin',
      'vehicleNotes',
      'vehicleConfiguration',
      'billingAddress',
      'billingPerson',
      'billingPhone',
      'shippingAddress',
      'shippingPerson',
      'shippingPhone',
      'shippingAt',
      'companyName',
      'milesOffered',
      'basePrice',
      'salesTax',
      'shippingCharges',
      'profit',
      'partialPayment',
      'cancellationReason',
      'cancelledAt',
      'refundType',
      'refundDeductionAmount',
      'refundDeductionReason',
      'refundedAt',
    ] as const;
    const updates: Prisma.JsonObject = {};

    for (const field of intakeFields) {
      if (updateOrderDto[field] !== undefined) {
        updates[field] = updateOrderDto[field] as Prisma.JsonValue;
      }
    }

    return updates;
  }

  private buildOrderAccessWhere(
    user: AuthenticatedUser,
    options: { restrictSalesToOwn?: boolean } = {},
  ): Prisma.OrderWhereInput {
    if (user.role === Role.SALES && options.restrictSalesToOwn) {
      return {
        createdById: user.userId,
      };
    }

    return {};
  }

  private buildFindAllWhere(
    queryOrdersDto: QueryOrdersDto,
    user: AuthenticatedUser,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = this.buildOrderAccessWhere(user);
    const orderNumber = queryOrdersDto.orderNumber?.trim();
    const search = queryOrdersDto.search?.trim();
    const createdById = queryOrdersDto.createdById?.trim();
    const phoneSearchTerms = search ? this.buildPhoneSearchTerms(search) : [];

    if (createdById) {
      where.createdById = createdById;
    }

    if (orderNumber) {
      where.orderNumber = {
        contains: orderNumber,
        mode: 'insensitive',
      };
    }

    if (queryOrdersDto.status) {
      where.status = queryOrdersDto.status;
    }

    if (queryOrdersDto.shipmentStatus) {
      if (queryOrdersDto.shipmentStatus === PrismaShipmentStatus.PENDING) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          {
            OR: [
              {
                shipments: {
                  none: {},
                },
              },
              {
                shipments: {
                  some: {
                    status: PrismaShipmentStatus.PENDING,
                  },
                },
              },
            ],
          },
        ];
      } else {
        where.shipments = {
          some: {
            status: queryOrdersDto.shipmentStatus,
          },
        };
      }
    }

    const hasShipmentFilter = this.normalizeHasShipmentFilter(
      queryOrdersDto.hasShipment,
    );
    const hasReplacementFilter = this.normalizeHasShipmentFilter(
      queryOrdersDto.hasReplacement,
    );

    if (hasReplacementFilter) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          replacementRequests: {
            some: {},
          },
        },
      ];
    }

    if (hasShipmentFilter !== undefined && !queryOrdersDto.shipmentStatus) {
      if (hasShipmentFilter) {
        where.shipments = { some: {} };
      } else {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          {
            OR: [
              {
                shipments: {
                  none: {},
                },
              },
              {
                shipments: {
                  some: {
                    status: {
                      in: SHIPMENT_WORKFLOW_STATUSES,
                    },
                  },
                },
              },
            ],
          },
        ];
      }
    }

    const createdAtFilter = buildCreatedAtFilter(
      queryOrdersDto.createdFrom,
      queryOrdersDto.createdTo,
    );
    const ageingFilter = this.buildAgeingCreatedAtFilter(
      queryOrdersDto.ageingRange,
    );
    const combinedCreatedAtFilter = this.mergeDateTimeFilters(
      createdAtFilter,
      ageingFilter,
    );

    if (combinedCreatedAtFilter) {
      where.createdAt = combinedCreatedAtFilter;
    }

    if (search) {
      if (this.isExactSalesNumberSearch(search)) {
        where.salesNumber = {
          equals: search,
          mode: 'insensitive',
        };
      } else {
        where.OR = [
          {
            orderNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            salesNumber: {
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
          ...phoneSearchTerms.map((phoneSearchTerm) => ({
            customerPhone: {
              contains: phoneSearchTerm,
              mode: 'insensitive' as const,
            },
          })),
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
          {
            intakeDetails: {
              path: ['advisorName'],
              string_contains: search,
            },
          },
        ];
      }
    }

    return where;
  }

  private buildAgeingCreatedAtFilter(
    ageingRange?: string,
  ): Prisma.DateTimeFilter | undefined {
    const normalizedAgeingRange = this.normalizeAgeingRange(ageingRange);

    if (!normalizedAgeingRange) {
      return undefined;
    }

    const today = this.getPacificDateParts(new Date());

    switch (normalizedAgeingRange) {
      case '0-7':
        return {
          gte: this.getPacificStartOfDayUtc(today, -7),
          lte: new Date(),
        };
      case '8-14':
        return {
          gte: this.getPacificStartOfDayUtc(today, -14),
          lt: this.getPacificStartOfDayUtc(today, -7),
        };
      case '15-30':
        return {
          gte: this.getPacificStartOfDayUtc(today, -30),
          lt: this.getPacificStartOfDayUtc(today, -14),
        };
      case '31+':
        return {
          lt: this.getPacificStartOfDayUtc(today, -30),
        };
      default:
        return undefined;
    }
  }

  private normalizeAgeingRange(ageingRange?: string): OrderAgeingRange | null {
    if (!ageingRange || ageingRange === 'ALL') {
      return null;
    }

    if (ORDER_AGEING_RANGES.includes(ageingRange as OrderAgeingRange)) {
      return ageingRange as OrderAgeingRange;
    }

    throw new BadRequestException('ageingRange filter is invalid.');
  }

  private mergeDateTimeFilters(
    first?: Prisma.DateTimeFilter,
    second?: Prisma.DateTimeFilter,
  ): Prisma.DateTimeFilter | undefined {
    if (!first) {
      return second;
    }

    if (!second) {
      return first;
    }

    const gte = this.getLatestDate(first.gte, second.gte);
    const lte = this.getEarliestDate(first.lte, second.lte);
    const lt = this.getEarliestDate(first.lt, second.lt);

    return {
      ...first,
      ...second,
      ...(gte ? { gte } : {}),
      ...(lte ? { lte } : {}),
      ...(lt ? { lt } : {}),
    };
  }

  private getLatestDate(
    first?: string | Date | undefined,
    second?: string | Date | undefined,
  ) {
    const firstDate = first ? new Date(first) : null;
    const secondDate = second ? new Date(second) : null;

    if (!firstDate) return secondDate ?? undefined;
    if (!secondDate) return firstDate;

    return firstDate > secondDate ? firstDate : secondDate;
  }

  private getEarliestDate(
    first?: string | Date | undefined,
    second?: string | Date | undefined,
  ) {
    const firstDate = first ? new Date(first) : null;
    const secondDate = second ? new Date(second) : null;

    if (!firstDate) return secondDate ?? undefined;
    if (!secondDate) return firstDate;

    return firstDate < secondDate ? firstDate : secondDate;
  }

  private getPacificDateParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: PACIFIC_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);

    return {
      year: valueFor('year'),
      month: valueFor('month'),
      day: valueFor('day'),
    };
  }

  private getPacificStartOfDayUtc(
    dateParts: { year: number; month: number; day: number },
    dayOffset = 0,
  ) {
    const date = new Date(
      Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + dayOffset),
    );

    return this.zonedTimeToUtc(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
  }

  private zonedTimeToUtc(
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0,
    second = 0,
  ) {
    const utcTimestamp = Date.UTC(year, month - 1, day, hour, minute, second);
    const firstPassOffset = this.getTimeZoneOffsetMs(
      new Date(utcTimestamp),
      PACIFIC_TIME_ZONE,
    );
    const firstPassDate = new Date(utcTimestamp - firstPassOffset);
    const finalOffset = this.getTimeZoneOffsetMs(firstPassDate, PACIFIC_TIME_ZONE);

    return new Date(utcTimestamp - finalOffset);
  }

  private getTimeZoneOffsetMs(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const localAsUtc = Date.UTC(
      valueFor('year'),
      valueFor('month') - 1,
      valueFor('day'),
      valueFor('hour'),
      valueFor('minute'),
      valueFor('second'),
    );

    return localAsUtc - date.getTime();
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

  private buildPhoneSearchTerms(search: string): string[] {
    const digits = search.replace(/\D/g, '');
    const normalizedDigits =
      digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    const terms = new Set<string>([search]);

    if (normalizedDigits.length === 10) {
      terms.add(
        `(${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(3, 6)}-${normalizedDigits.slice(6)}`,
      );
    }

    return Array.from(terms);
  }

  private isExactSalesNumberSearch(search: string): boolean {
    return /^\d{1,9}$/.test(search.trim());
  }

  private buildOrderNumberDateSegment(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);

    return `${month}${day}${year}`;
  }

  private buildIntakeDetailsPayload(createOrderDto: CreateOrderPayload) {
    return {
      advisorName: createOrderDto.advisorName,
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
