import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { handlePrismaError } from '../../common/utils/prisma-exception.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateCostDto } from './dto/create-cost.dto';
import { UpdateCostDto } from './dto/update-cost.dto';

type CreateCostPayload = CreateCostDto & {
  grossProfit: Prisma.Decimal;
};

const shipmentCostAmountSelect = {
  shipmentId: true,
  purchaseAmount: true,
  shippingAmount: true,
  additionalAmount: true,
} satisfies Prisma.ShipmentCostSelect;

const shipmentCostInclude = {
  shipment: {
    select: {
      id: true,
      proNumber: true,
      status: true,
      orderId: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalSaleAmount: true,
        },
      },
    },
  },
} satisfies Prisma.ShipmentCostInclude;

@Injectable()
export class CostsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async existsByShipmentId(shipmentId: string): Promise<boolean> {
    const shipmentCost = await this.prismaService.shipmentCost.findUnique({
      where: { shipmentId },
      select: { shipmentId: true },
    });

    return Boolean(shipmentCost);
  }

  async create(createCostDto: CreateCostPayload) {
    try {
      return await this.prismaService.shipmentCost.create({
        data: {
          shipment: {
            connect: {
              id: createCostDto.shipmentId,
            },
          },
          purchaseAmount: createCostDto.purchaseAmount,
          shippingAmount: createCostDto.shippingAmount ?? 0,
          additionalAmount: createCostDto.additionalAmount ?? 0,
          grossProfit: createCostDto.grossProfit,
          currency: createCostDto.currency?.trim().toUpperCase() ?? 'USD',
          notes: createCostDto.notes?.trim(),
        },
        include: shipmentCostInclude,
      });
    } catch (error) {
      handlePrismaError(error, 'Shipment cost');
    }
  }

  async findAmountsByShipmentId(shipmentId: string) {
    const shipmentCost = await this.prismaService.shipmentCost.findUnique({
      where: { shipmentId },
      select: shipmentCostAmountSelect,
    });

    if (!shipmentCost) {
      throw new NotFoundException('Shipment cost was not found.');
    }

    return shipmentCost;
  }

  async findByShipmentId(shipmentId: string) {
    const shipmentCost = await this.prismaService.shipmentCost.findUnique({
      where: { shipmentId },
      include: shipmentCostInclude,
    });

    if (!shipmentCost) {
      throw new NotFoundException('Shipment cost was not found.');
    }

    return shipmentCost;
  }

  async updateByShipmentId(
    shipmentId: string,
    updateCostDto: UpdateCostDto & { grossProfit?: Prisma.Decimal },
  ) {
    const data: Prisma.ShipmentCostUncheckedUpdateInput = {};

    if (updateCostDto.purchaseAmount !== undefined) {
      data.purchaseAmount = updateCostDto.purchaseAmount;
    }

    if (updateCostDto.shippingAmount !== undefined) {
      data.shippingAmount = updateCostDto.shippingAmount;
    }

    if (updateCostDto.additionalAmount !== undefined) {
      data.additionalAmount = updateCostDto.additionalAmount;
    }

    if (updateCostDto.grossProfit !== undefined) {
      data.grossProfit = updateCostDto.grossProfit;
    }

    if (updateCostDto.currency !== undefined) {
      data.currency = updateCostDto.currency.trim().toUpperCase();
    }

    if (updateCostDto.notes !== undefined) {
      data.notes = updateCostDto.notes.trim();
    }

    try {
      return await this.prismaService.shipmentCost.update({
        where: { shipmentId },
        data,
        include: shipmentCostInclude,
      });
    } catch (error) {
      handlePrismaError(error, 'Shipment cost');
    }
  }
}
