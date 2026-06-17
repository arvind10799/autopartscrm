import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateCostDto } from './dto/create-cost.dto';
import { UpdateCostDto } from './dto/update-cost.dto';
import { CostsRepository } from './costs.repository';

@Injectable()
export class CostsService {
  constructor(
    private readonly costsRepository: CostsRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async create(createCostDto: CreateCostDto) {
    const shipment = await this.getShipmentWithOrder(createCostDto.shipmentId);
    await this.ensureShipmentCostDoesNotExist(createCostDto.shipmentId);

    return this.costsRepository.create({
      ...createCostDto,
      grossProfit: this.calculateGrossProfit(
        shipment.order.totalSaleAmount,
        this.resolveCostAmounts(createCostDto),
      ),
    });
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

    return this.costsRepository.updateByShipmentId(shipmentId, {
      ...updateCostDto,
      grossProfit: this.calculateGrossProfit(
        shipment.order.totalSaleAmount,
        nextAmounts,
      ),
    });
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
