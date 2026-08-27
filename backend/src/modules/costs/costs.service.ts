import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateAdditionalCostDto } from './dto/create-additional-cost.dto';
import { CreateCostDto } from './dto/create-cost.dto';
import { UpdateCostDto } from './dto/update-cost.dto';
import { CostsRepository } from './costs.repository';

@Injectable()
export class CostsService {
  constructor(
    private readonly costsRepository: CostsRepository,
    private readonly prismaService: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createCostDto: CreateCostDto) {
    const shipment = await this.getShipmentWithOrder(createCostDto.shipmentId);
    await this.ensureShipmentCostDoesNotExist(createCostDto.shipmentId);

    const cost = await this.costsRepository.create({
      ...createCostDto,
      grossProfit: this.calculateGrossProfit(
        shipment.order.totalSaleAmount,
        this.resolveCostAmounts(createCostDto),
      ),
    });
    await this.notificationsService.notifyShipmentActivity(
      createCostDto.shipmentId,
      'Shipment cost was added.',
    );

    return cost;
  }

  findByShipmentId(shipmentId: string) {
    return this.costsRepository.findByShipmentId(shipmentId);
  }

  async updateByShipmentId(shipmentId: string, updateCostDto: UpdateCostDto) {
    if (Object.values(updateCostDto).every((value) => value === undefined)) {
      throw new BadRequestException(
        'At least one shipment cost field must be provided for update.',
      );
    }

    const shipment = await this.getShipmentWithOrder(shipmentId);
    this.ensureShipmentCostEditable(shipment.status);
    const existingAmounts =
      await this.costsRepository.findAmountsByShipmentId(shipmentId);

    const nextAmounts = this.resolveCostAmounts(updateCostDto, existingAmounts);

    const cost = await this.costsRepository.updateByShipmentId(shipmentId, {
      ...updateCostDto,
      grossProfit: this.calculateGrossProfit(
        shipment.order.totalSaleAmount,
        nextAmounts,
      ),
    });
    await this.notificationsService.notifyShipmentActivity(
      shipmentId,
      'Shipment cost was updated.',
    );

    return cost;
  }

  async createAdditionalCost(
    shipmentId: string,
    createAdditionalCostDto: CreateAdditionalCostDto,
    user: AuthenticatedUser,
  ) {
    const shipment = await this.getShipmentWithOrder(shipmentId);
    this.ensureShipmentCostEditable(shipment.status);

    const additionalCost = await this.costsRepository.createAdditionalCost(
      shipmentId,
      {
        amount: createAdditionalCostDto.amount,
        reason: createAdditionalCostDto.reason,
        createdById: user.userId,
      },
    );
    const additionalAmount =
      await this.costsRepository.sumAdditionalCostsByShipmentId(shipmentId);
    const existingAmounts =
      await this.costsRepository.findAmountsByShipmentId(shipmentId);
    const grossProfit = this.calculateGrossProfit(
      shipment.order.totalSaleAmount,
      {
        purchaseAmount: Number(existingAmounts.purchaseAmount),
        shippingAmount: Number(existingAmounts.shippingAmount),
        additionalAmount: Number(additionalAmount),
      },
    );

    await this.costsRepository.updateByShipmentId(shipmentId, {
      additionalAmount: Number(additionalAmount),
      grossProfit,
    });
    await this.notificationsService.notifyShipmentActivity(
      shipmentId,
      'Additional shipment cost was added.',
    );

    return additionalCost;
  }

  private async getShipmentWithOrder(shipmentId: string) {
    const shipment = await this.prismaService.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        id: true,
        status: true,
        order: {
          select: {
            id: true,
            totalSaleAmount: true,
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment was not found.');
    }

    return shipment;
  }

  private async ensureShipmentCostDoesNotExist(
    shipmentId: string,
  ): Promise<void> {
    const exists = await this.costsRepository.existsByShipmentId(shipmentId);

    if (exists) {
      throw new BadRequestException(
        'Shipment cost already exists for this shipment.',
      );
    }
  }

  private ensureShipmentCostEditable(status: ShipmentStatus): void {
    if (status === ShipmentStatus.DELIVERED) {
      throw new BadRequestException(
        'Shipment cost cannot be edited after the shipment is delivered.',
      );
    }
  }

  private resolveCostAmounts(
    dto: Pick<
      CreateCostDto | UpdateCostDto,
      'purchaseAmount' | 'shippingAmount' | 'additionalAmount'
    >,
    existing?: {
      purchaseAmount: Prisma.Decimal;
      shippingAmount: Prisma.Decimal;
      additionalAmount: Prisma.Decimal;
    },
  ): {
    purchaseAmount: number;
    shippingAmount: number;
    additionalAmount: number;
  } {
    return {
      purchaseAmount:
        dto.purchaseAmount ?? Number(existing?.purchaseAmount ?? 0),
      shippingAmount:
        dto.shippingAmount ?? Number(existing?.shippingAmount ?? 0),
      additionalAmount:
        dto.additionalAmount ?? Number(existing?.additionalAmount ?? 0),
    };
  }

  private calculateGrossProfit(
    totalSaleAmount: Prisma.Decimal,
    costs: {
      purchaseAmount: number;
      shippingAmount: number;
      additionalAmount: number;
    },
  ): Prisma.Decimal {
    return new Prisma.Decimal(totalSaleAmount)
      .sub(costs.purchaseAmount)
      .sub(costs.shippingAmount)
      .sub(costs.additionalAmount);
  }
}
