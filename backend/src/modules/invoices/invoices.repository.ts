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

const invoiceOrderReferenceSelect = {
  id: true,
  customerEmail: true,
  customerPhone: true,
  orderNumber: true,
  currency: true,
} satisfies Prisma.OrderSelect;

const invoiceBaseSelect = {
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
  customerSignatureImage: true,
  signatureDate: true,
  photoIdRequired: true,
  photoIdFileName: true,
  photoIdMimeType: true,
  photoIdUploadedAt: true,
  signedAt: true,
  signatureIpAddress: true,
  signatureTokenHash: true,
  signatureTokenExpiresAt: true,
  signatureRequestedAt: true,
  signatureLastSentAt: true,
  status: true,
  pdfStorageKey: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: invoiceOrderReferenceSelect,
  },
  auditEvents: invoiceAuditEventsInclude,
} satisfies Prisma.InvoiceSelect;

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
      select: invoiceBaseSelect,
    });
  }

  findPhotoIdByOrderId(orderId: string, user: AuthenticatedUser) {
    return this.prismaService.invoice.findFirst({
      where: {
        orderId,
        order: this.buildOrderAccessWhere(user),
      },
      select: {
        id: true,
        orderId: true,
        invoiceNumber: true,
        photoIdDocument: true,
        photoIdFileName: true,
        photoIdMimeType: true,
        photoIdUploadedAt: true,
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
          select: invoiceOrderReferenceSelect,
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
            select: invoiceOrderReferenceSelect,
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
          select: invoiceOrderReferenceSelect,
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
            select: invoiceOrderReferenceSelect,
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
