import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ShipmentStatus } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
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

  async create(createCostDto: CreateCostDto, user: AuthenticatedUser) {
    const shipment = await this.getShipmentWithOrder(createCostDto.shipmentId);
    this.ensureBaseShipmentCostEditable(shipment.status, user);
    await this.ensureShipmentCostDoesNotExist(createCostDto.shipmentId);

    const cost = await this.costsRepository.create({
      ...createCostDto,
      grossProfit: this.calculateGrossProfit(
        shipment.order.totalSaleAmount,
        this.resolveCostAmounts(createCostDto),
      ),
    });
    await this.recordCostHistory(createCostDto.shipmentId, {
      action: 'GP_COST_CREATED',
      summary: 'GP cost record was created.',
      changes: [
        this.buildChange('Part cost', null, createCostDto.purchaseAmount),
        this.buildChange('Actual shipping cost', null, createCostDto.shippingAmount ?? 0),
        this.buildChange(
          'Estimated purchase cost',
          null,
          createCostDto.estimatedPurchaseAmount ?? 0,
        ),
        this.buildChange(
          'Estimated shipping cost',
          null,
          createCostDto.estimatedShippingAmount ?? 0,
        ),
        this.buildChange('Additional costs', null, createCostDto.additionalAmount ?? 0),
        this.buildChange('Currency', null, createCostDto.currency?.trim().toUpperCase() ?? 'USD'),
      ],
      user,
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

  async updateByShipmentId(
    shipmentId: string,
    updateCostDto: UpdateCostDto,
    user: AuthenticatedUser,
  ) {
    if (Object.values(updateCostDto).every((value) => value === undefined)) {
      throw new BadRequestException(
        'At least one shipment cost field must be provided for update.',
      );
    }

    const shipment = await this.getShipmentWithOrder(shipmentId);
    this.ensureBaseShipmentCostEditable(shipment.status, user);
    const existingAmounts =
      await this.costsRepository.findAmountsByShipmentId(shipmentId);

    const nextAmounts = this.resolveCostAmounts(updateCostDto, existingAmounts);
    const changes = this.buildBaseCostChanges(existingAmounts, updateCostDto);
    const editNote = updateCostDto.notes?.trim();

    const cost = await this.costsRepository.updateByShipmentId(shipmentId, {
      ...updateCostDto,
      grossProfit: this.calculateGrossProfit(
        shipment.order.totalSaleAmount,
        nextAmounts,
      ),
    });
    if (changes.length > 0) {
      await this.recordCostHistory(shipmentId, {
        action: 'GP_COST_UPDATED',
        summary: `GP costs updated: ${changes
          .map((change) => change.label)
          .join(', ')}.`,
        changes: editNote
          ? [...changes, this.buildChange('Edit note', null, editNote)]
          : changes,
        user,
      });
    }
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
    await this.getShipmentWithOrder(shipmentId);

    const additionalCost = await this.costsRepository.createAdditionalCost(
      shipmentId,
      {
        amount: createAdditionalCostDto.amount,
        reason: createAdditionalCostDto.reason,
        createdById: user.userId,
      },
    );
    await this.recordCostHistory(shipmentId, {
      action: 'ADDITIONAL_COST_ADDED',
      summary: `Additional cost added: ${this.formatMoneyLike(
        createAdditionalCostDto.amount,
      )}.`,
      changes: [
        this.buildChange('Additional cost', null, createAdditionalCostDto.amount),
        this.buildChange('Reason', null, createAdditionalCostDto.reason),
      ],
      user,
    });
    await this.recalculateShipmentCostTotals(shipmentId);
    await this.notificationsService.notifyShipmentActivity(
      shipmentId,
      'Additional shipment cost was added.',
    );

    return additionalCost;
  }

  async updateAdditionalCost(
    shipmentId: string,
    additionalCostId: string,
    updateAdditionalCostDto: CreateAdditionalCostDto,
    user: AuthenticatedUser,
  ) {
    await this.getShipmentWithOrder(shipmentId);
    const existingAdditionalCost =
      await this.costsRepository.findAdditionalCostById(additionalCostId);

    if (existingAdditionalCost.shipmentId !== shipmentId) {
      throw new NotFoundException('Shipment additional cost was not found.');
    }

    const additionalCost = await this.costsRepository.updateAdditionalCost(
      additionalCostId,
      {
        amount: updateAdditionalCostDto.amount,
        reason: updateAdditionalCostDto.reason,
      },
    );
    const changes = [
      this.buildChange(
        'Additional cost',
        existingAdditionalCost.amount,
        updateAdditionalCostDto.amount,
      ),
      this.buildChange(
        'Reason',
        existingAdditionalCost.reason,
        updateAdditionalCostDto.reason,
      ),
    ].filter((change) => change.oldValue !== change.newValue);

    if (changes.length > 0) {
      await this.recordCostHistory(shipmentId, {
        action: 'ADDITIONAL_COST_UPDATED',
        summary: `Additional cost updated: ${changes
          .map((change) => change.label)
          .join(', ')}.`,
        changes,
        user,
      });
    }

    await this.recalculateShipmentCostTotals(shipmentId);
    await this.notificationsService.notifyShipmentActivity(
      shipmentId,
      'Additional shipment cost was updated.',
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

  private ensureBaseShipmentCostEditable(
    status: ShipmentStatus,
    user: AuthenticatedUser,
  ): void {
    if (
      status === ShipmentStatus.DELIVERED &&
      user.role !== Role.ADMIN &&
      user.role !== Role.SHIPPING
    ) {
      throw new BadRequestException(
        'Shipment cost cannot be edited after the shipment is delivered.',
      );
    }
  }

  private async recalculateShipmentCostTotals(shipmentId: string) {
    const shipment = await this.getShipmentWithOrder(shipmentId);
    const additionalAmount =
      await this.costsRepository.sumAdditionalCostsByShipmentId(shipmentId);
    const existingAmounts =
      await this.costsRepository.findAmountsByShipmentId(shipmentId);
    const grossProfit = this.calculateGrossProfit(
      shipment.order.totalSaleAmount,
      {
        purchaseAmount: Number(existingAmounts.purchaseAmount),
        shippingAmount: Number(existingAmounts.shippingAmount),
        estimatedPurchaseAmount: Number(existingAmounts.estimatedPurchaseAmount),
        estimatedShippingAmount: Number(existingAmounts.estimatedShippingAmount),
        hasActualPurchaseAmount: existingAmounts.hasActualPurchaseAmount,
        hasActualShippingAmount: existingAmounts.hasActualShippingAmount,
        additionalAmount: Number(additionalAmount),
      },
    );

    await this.costsRepository.updateByShipmentId(shipmentId, {
      additionalAmount: Number(additionalAmount),
      grossProfit,
    });
  }

  private resolveCostAmounts(
    dto: Pick<
      CreateCostDto | UpdateCostDto,
      | 'purchaseAmount'
      | 'shippingAmount'
      | 'estimatedPurchaseAmount'
      | 'estimatedShippingAmount'
      | 'additionalAmount'
    >,
    existing?: {
      purchaseAmount: Prisma.Decimal;
      shippingAmount: Prisma.Decimal;
      estimatedPurchaseAmount: Prisma.Decimal;
      estimatedShippingAmount: Prisma.Decimal;
      hasActualPurchaseAmount: boolean;
      hasActualShippingAmount: boolean;
      additionalAmount: Prisma.Decimal;
      currency?: string;
    },
  ): {
    purchaseAmount: number;
    shippingAmount: number;
    estimatedPurchaseAmount: number;
    estimatedShippingAmount: number;
    hasActualPurchaseAmount: boolean;
    hasActualShippingAmount: boolean;
    additionalAmount: number;
  } {
    return {
      purchaseAmount:
        dto.purchaseAmount ?? Number(existing?.purchaseAmount ?? 0),
      shippingAmount:
        dto.shippingAmount ?? Number(existing?.shippingAmount ?? 0),
      estimatedPurchaseAmount:
        dto.estimatedPurchaseAmount ??
        Number(existing?.estimatedPurchaseAmount ?? 0),
      estimatedShippingAmount:
        dto.estimatedShippingAmount ??
        Number(existing?.estimatedShippingAmount ?? 0),
      hasActualPurchaseAmount:
        dto.purchaseAmount !== undefined ||
        Boolean(existing?.hasActualPurchaseAmount),
      hasActualShippingAmount:
        dto.shippingAmount !== undefined ||
        Boolean(existing?.hasActualShippingAmount),
      additionalAmount:
        dto.additionalAmount ?? Number(existing?.additionalAmount ?? 0),
    };
  }

  private calculateGrossProfit(
    totalSaleAmount: Prisma.Decimal,
    costs: {
      purchaseAmount: number;
      shippingAmount: number;
      estimatedPurchaseAmount: number;
      estimatedShippingAmount: number;
      hasActualPurchaseAmount: boolean;
      hasActualShippingAmount: boolean;
      additionalAmount: number;
    },
  ): Prisma.Decimal {
    const effectivePurchaseAmount = costs.hasActualPurchaseAmount
      ? costs.purchaseAmount
      : costs.estimatedPurchaseAmount;
    const effectiveShippingAmount = costs.hasActualShippingAmount
      ? costs.shippingAmount
      : costs.estimatedShippingAmount;

    return new Prisma.Decimal(totalSaleAmount)
      .sub(effectivePurchaseAmount)
      .sub(effectiveShippingAmount)
      .sub(costs.additionalAmount);
  }

  private buildBaseCostChanges(
    existingAmounts: {
      purchaseAmount: Prisma.Decimal;
      shippingAmount: Prisma.Decimal;
      additionalAmount: Prisma.Decimal;
      estimatedPurchaseAmount: Prisma.Decimal;
      estimatedShippingAmount: Prisma.Decimal;
      hasActualPurchaseAmount: boolean;
      hasActualShippingAmount: boolean;
      currency: string;
    },
    updateCostDto: UpdateCostDto,
  ) {
    return [
      updateCostDto.purchaseAmount === undefined
        ? null
        : this.buildChange(
            'Part cost',
            existingAmounts.purchaseAmount,
            updateCostDto.purchaseAmount,
          ),
      updateCostDto.shippingAmount === undefined
        ? null
        : this.buildChange(
            'Actual shipping cost',
            existingAmounts.shippingAmount,
            updateCostDto.shippingAmount,
          ),
      updateCostDto.additionalAmount === undefined
        ? null
        : this.buildChange(
            'Additional costs',
            existingAmounts.additionalAmount,
            updateCostDto.additionalAmount,
          ),
      updateCostDto.estimatedPurchaseAmount === undefined ||
      existingAmounts.hasActualPurchaseAmount
        ? null
        : this.buildChange(
            'Estimated purchase cost',
            existingAmounts.estimatedPurchaseAmount,
            updateCostDto.estimatedPurchaseAmount,
          ),
      updateCostDto.estimatedShippingAmount === undefined ||
      existingAmounts.hasActualShippingAmount
        ? null
        : this.buildChange(
            'Estimated shipping cost',
            existingAmounts.estimatedShippingAmount,
            updateCostDto.estimatedShippingAmount,
          ),
      updateCostDto.currency === undefined
        ? null
        : this.buildChange(
            'Currency',
            existingAmounts.currency,
            updateCostDto.currency.trim().toUpperCase(),
          ),
    ].filter(this.isMeaningfulHistoryChange);
  }

  private buildChange(
    label: string,
    oldValue: Prisma.Decimal | number | string | null | undefined,
    newValue: Prisma.Decimal | number | string | null | undefined,
  ) {
    return {
      label,
      oldValue: this.formatHistoryValue(oldValue),
      newValue: this.formatHistoryValue(newValue),
    };
  }

  private isMeaningfulHistoryChange(
    change: {
      label: string;
      oldValue: string | null;
      newValue: string | null;
    } | null,
  ): change is {
    label: string;
    oldValue: string | null;
    newValue: string | null;
  } {
    return change !== null && change.oldValue !== change.newValue;
  }

  private formatHistoryValue(
    value: Prisma.Decimal | number | string | null | undefined,
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Prisma.Decimal) {
      return this.formatMoneyLike(Number(value));
    }

    if (typeof value === 'number') {
      return this.formatMoneyLike(value);
    }

    return value.trim();
  }

  private formatMoneyLike(value: number): string {
    return Number(value).toFixed(2);
  }

  private recordCostHistory(
    shipmentId: string,
    payload: {
      action: string;
      summary: string;
      changes: Array<{
        label: string;
        oldValue: string | null;
        newValue: string | null;
      }>;
      user: AuthenticatedUser;
    },
  ) {
    return this.costsRepository.createCostHistory(shipmentId, {
      action: payload.action,
      summary: payload.summary,
      changes: {
        fields: payload.changes,
      },
      createdById: payload.user.userId,
    });
  }
}
