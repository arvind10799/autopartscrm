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
  partDescription: true,
  customerPhone: true,
  intakeDetails: true,
  quantity: true,
  totalSaleAmount: true,
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
          },
        },
      },
    });
  }

  async create(data: Prisma.InvoiceUncheckedCreateInput) {
    try {
      return await this.prismaService.invoice.create({
        data,
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
