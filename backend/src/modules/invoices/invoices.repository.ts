import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { handlePrismaError } from '../../common/utils/prisma-exception.util';
import { PrismaService } from '../../database/prisma/prisma.service';

const invoiceOrderSelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  customerEmail: true,
  partDescription: true,
  customerPhone: true,
  intakeDetails: true,
  quantity: true,
  status: true,
  totalSaleAmount: true,
  currency: true,
  createdById: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.OrderSelect;

const invoiceAuditEventsInclude = {
  orderBy: {
    occurredAt: 'desc',
  },
} satisfies Prisma.InvoiceAuditEventFindManyArgs;

export type InvoiceOrder = Prisma.OrderGetPayload<{
  select: typeof invoiceOrderSelect;
}>;

@Injectable()
export class InvoicesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findAccessibleOrder(orderId: string, user: AuthenticatedUser) {
    const order = await this.prismaService.order.findFirst({
      where: {
        id: orderId,
        ...this.buildOrderAccessWhere(user),
      },
      select: invoiceOrderSelect,
    });

    if (!order) {
      throw new NotFoundException('Order was not found.');
    }

    return order;
  }

  findByOrderId(orderId: string, user: AuthenticatedUser) {
    return this.prismaService.invoice.findFirst({
      where: {
        orderId,
        order: this.buildOrderAccessWhere(user),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerEmail: true,
            customerPhone: true,
            currency: true,
          },
        },
        auditEvents: invoiceAuditEventsInclude,
      },
    });
  }

  findById(id: string) {
    return this.prismaService.invoice.findUnique({
      where: {
        id,
      },
      include: {
        order: {
          select: {
            id: true,
            customerEmail: true,
            customerPhone: true,
            orderNumber: true,
            currency: true,
          },
        },
        auditEvents: invoiceAuditEventsInclude,
      },
    });
  }

  async create(data: Prisma.InvoiceUncheckedCreateInput) {
    try {
      return await this.prismaService.invoice.create({
        data,
        include: {
          order: {
            select: {
              id: true,
              customerEmail: true,
              customerPhone: true,
              orderNumber: true,
              currency: true,
            },
          },
          auditEvents: invoiceAuditEventsInclude,
        },
      });
    } catch (error) {
      handlePrismaError(error, 'Invoice');
    }
  }

  findByTokenHash(signatureTokenHash: string) {
    return this.prismaService.invoice.findUnique({
      where: {
        signatureTokenHash,
      },
      include: {
        order: {
          select: {
            id: true,
            customerEmail: true,
            customerPhone: true,
            orderNumber: true,
            currency: true,
          },
        },
        auditEvents: invoiceAuditEventsInclude,
      },
    });
  }

  async createAuditEvent(data: Prisma.InvoiceAuditEventUncheckedCreateInput) {
    return this.prismaService.invoiceAuditEvent.create({
      data,
    });
  }

  async update(id: string, data: Prisma.InvoiceUncheckedUpdateInput) {
    try {
      return await this.prismaService.invoice.update({
        where: { id },
        data,
        include: {
          order: {
            select: {
              id: true,
              customerEmail: true,
              customerPhone: true,
              orderNumber: true,
              currency: true,
            },
          },
          auditEvents: invoiceAuditEventsInclude,
        },
      });
    } catch (error) {
      handlePrismaError(error, 'Invoice');
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
}
