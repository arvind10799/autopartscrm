import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import { OrderPaymentMethod } from '../../common/enums/order-payment-method.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { Role } from '../../common/enums/role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { getPacificTodayDateInputValue } from '../../common/utils/pacific-date.util';
import { OrdersJobsService } from '../jobs/orders-jobs.service';
import { LeadsRepository } from '../leads/leads.repository';
import { NotesService } from '../notes/notes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersCacheService } from './orders-cache.service';
import { OrdersRepository } from './orders.repository';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { RefundOrderDto, RefundType } from './dto/refund-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  private static readonly maxOrderNumberAttempts = 5;

  private static readonly paymentRequiredStatuses = new Set<string>([
    OrderStatus.PARTIALLY_PAID,
    OrderStatus.CONFIRMED,
  ]);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ordersRepository: OrdersRepository,
    private readonly ordersCacheService: OrdersCacheService,
    private readonly ordersJobsService: OrdersJobsService,
    private readonly leadsRepository: LeadsRepository,
    private readonly notesService: NotesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createOrderDto: CreateOrderDto, user: AuthenticatedUser) {
    const normalizedStatus = createOrderDto.status ?? OrderStatus.CONFIRMED;
    const normalizedCreateOrderDto =
      normalizedStatus === OrderStatus.CONFIRMED
        ? {
            ...createOrderDto,
            partialPayment: undefined,
          }
        : createOrderDto;

    this.assertPastOrTodayDate(
      normalizedCreateOrderDto.orderDate,
      'Order date cannot be in the future.',
    );
    this.validatePaymentMethodForStatus(
      normalizedStatus,
      normalizedCreateOrderDto.paymentMethod,
    );

    if (normalizedCreateOrderDto.leadId) {
      await this.leadsRepository.findConvertibleById(
        normalizedCreateOrderDto.leadId,
        user,
      );
    }

    const order = await this.createWithGeneratedOrderNumber(
      normalizedCreateOrderDto,
      normalizedStatus,
      user,
    );

    if (normalizedCreateOrderDto.note) {
      await this.notesService.create(
        {
          content: normalizedCreateOrderDto.note,
          entityType: NoteEntityType.ORDER,
          entityId: order.id,
        },
        user,
      );
    }

    await this.afterMutation(order.id, 'created');
    await this.notificationsService.notifyOrderCreated(order.id, user);

    return order;
  }

  async findAll(
    queryOrdersDto: QueryOrdersDto,
    user: AuthenticatedUser,
  ) {
    return this.ordersCacheService.rememberList(queryOrdersDto, user, () =>
      this.ordersRepository.findAll(queryOrdersDto, user),
    );
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const order = await this.ordersRepository.findOne(id, user);
    const invoice = order.invoice;

    if (!invoice) {
      return order;
    }

    const { _count, ...invoiceSummary } = invoice;

    return {
      ...order,
      invoice: {
        ...invoiceSummary,
        currency: order.currency === 'CAD' ? 'CAD' : 'USD',
        customerSignatureImage: null,
        photoIdDocument: null,
        auditTrail: null,
        hasAuditTrail:
          _count.auditEvents > 0 ||
          Boolean(invoice.signatureRequestedAt || invoice.signedAt),
        hasPhotoIdDocument: Boolean(
          invoice.photoIdFileName || invoice.photoIdUploadedAt,
        ),
      },
    };
  }

  findOrderAgents() {
    return this.ordersRepository.findOrderAgents();
  }

  async getNextOrderNumber() {
    return {
      orderNumber: await this.ordersRepository.getNextOrderNumber(),
    };
  }

  async update(
    id: string,
    updateOrderDto: UpdateOrderDto,
    user: AuthenticatedUser,
  ) {
    if (Object.values(updateOrderDto).every((value) => value === undefined)) {
      throw new BadRequestException(
        'At least one order field must be provided for update.',
      );
    }

    this.validateUpdateAccess(updateOrderDto, user);

    const existingOrder = await this.ordersRepository.findEditableById(id, user);
    const nextStatus = updateOrderDto.status ?? existingOrder.status;
    const nextPaymentMethod =
      updateOrderDto.paymentMethod !== undefined
        ? updateOrderDto.paymentMethod
        : existingOrder.paymentMethod;

    if (updateOrderDto.orderDate) {
      this.assertPastOrTodayDate(
        updateOrderDto.orderDate,
        'Order date cannot be in the future.',
      );
    }

    if (user.role !== Role.ADMIN) {
      this.validatePaymentMethodForStatus(nextStatus, nextPaymentMethod);
    }

    if (
      nextStatus === OrderStatus.PARTIALLY_PAID &&
      updateOrderDto.partialPayment !== undefined &&
      updateOrderDto.partialPayment <= 0
    ) {
      throw new BadRequestException(
        'Partial payment must be greater than zero for partially paid orders.',
      );
    }
    const changeHistoryMessage = this.buildOrderUpdateHistoryMessage(
      existingOrder,
      updateOrderDto,
    );
    const hasFieldChanges = Boolean(changeHistoryMessage);
    const hasNote = Boolean(updateOrderDto.note);

    if (!hasFieldChanges && !hasNote) {
      throw new BadRequestException(
        'No order changes or notes were detected.',
      );
    }

    if (hasFieldChanges) {
      await this.ordersRepository.update(id, {
        ...updateOrderDto,
      });

      await this.notesService.create(
        {
          content: changeHistoryMessage!,
          entityType: NoteEntityType.ORDER,
          entityId: id,
        },
        user,
      );
    }

    if (hasNote) {
      await this.notesService.create(
        {
          content: updateOrderDto.note!,
          entityType: NoteEntityType.ORDER,
          entityId: id,
        },
        user,
      );
    }

    await this.afterMutation(id, 'updated');
    if (hasFieldChanges) {
      await this.notificationsService.notifyOrderUpdated(id, user);
    }

    return this.ordersRepository.findSummaryById(id, user);
  }

  async cancel(
    id: string,
    cancelOrderDto: CancelOrderDto,
    user: AuthenticatedUser,
  ) {
    await this.ordersRepository.findEditableById(id, user);

    const cancellationReason = cancelOrderDto.cancellationReason.trim();
    if (!cancellationReason) {
      throw new BadRequestException('Cancellation reason is required.');
    }

    await this.ordersRepository.update(id, {
      status: OrderStatus.CANCELLED,
      cancellationReason,
      cancelledAt: new Date().toISOString(),
    });

    await this.notesService.create(
      {
        content: `Order cancelled:\n- Cancellation reason: ${cancellationReason}`,
        entityType: NoteEntityType.ORDER,
        entityId: id,
      },
      user,
    );

    await this.afterMutation(id, 'updated');
    await this.notificationsService.notifyOrderUpdated(id, user);

    return this.ordersRepository.findSummaryById(id, user);
  }

  async refund(
    id: string,
    refundOrderDto: RefundOrderDto,
    user: AuthenticatedUser,
  ) {
    const existingOrder = await this.ordersRepository.findEditableById(id, user);
    const refundType = refundOrderDto.refundType;
    const refundUpdate: {
      refundType: RefundType;
      refundDeductionAmount?: number | null;
      refundDeductionReason?: string | null;
    } = { refundType };

    if (refundType === RefundType.PARTIAL) {
      const deductionAmount = refundOrderDto.refundDeductionAmount;
      const deductionReason = refundOrderDto.refundDeductionReason?.trim();

      if (deductionAmount === undefined || deductionAmount <= 0) {
        throw new BadRequestException(
          'Deduction amount is required for partial refunds.',
        );
      }

      if (deductionAmount > Number(existingOrder.totalSaleAmount)) {
        throw new BadRequestException(
          'Deduction amount cannot be greater than the total order amount.',
        );
      }

      if (!deductionReason) {
        throw new BadRequestException(
          'Reason for deduction is required for partial refunds.',
        );
      }

      refundUpdate.refundDeductionAmount = deductionAmount;
      refundUpdate.refundDeductionReason = deductionReason;
    } else {
      refundUpdate.refundDeductionAmount = null;
      refundUpdate.refundDeductionReason = null;
    }

    await this.ordersRepository.update(id, {
      status: OrderStatus.REFUNDED,
      refundedAt: new Date().toISOString(),
      ...refundUpdate,
    });

    const retainedAmount =
      refundType === RefundType.PARTIAL
        ? Number(refundUpdate.refundDeductionAmount ?? 0)
        : 0;
    const gpAmount = await this.calculateRefundGrossProfit(id, retainedAmount);
    const formattedGp = this.formatCurrencyAmount(gpAmount, existingOrder.currency);
    const formattedDeduction = this.formatCurrencyAmount(
      Number(refundUpdate.refundDeductionAmount ?? 0),
      existingOrder.currency,
    );
    const formattedCustomerRefund = this.formatCurrencyAmount(
      Math.max(Number(existingOrder.totalSaleAmount) - retainedAmount, 0),
      existingOrder.currency,
    );

    await this.notesService.create(
      {
        content:
          refundType === RefundType.FULL
            ? `Order refunded:\n- Refund type: Full refund\n- GP: ${formattedGp}`
            : `Order refunded:\n- Refund type: Partial refund\n- Customer refunded amount: ${formattedCustomerRefund}\n- Deduction amount: ${formattedDeduction}\n- Reason for deduction: ${refundUpdate.refundDeductionReason}\n- GP: ${formattedGp}`,
        entityType: NoteEntityType.ORDER,
        entityId: id,
      },
      user,
    );

    await this.afterMutation(id, 'updated');
    await this.notificationsService.notifyOrderUpdated(id, user);

    return this.ordersRepository.findSummaryById(id, user);
  }

  private async calculateRefundGrossProfit(
    orderId: string,
    retainedAmount: number,
  ): Promise<number> {
    const latestShipment = await this.prismaService.shipment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      select: {
        costs: {
          take: 1,
          select: {
            purchaseAmount: true,
            shippingAmount: true,
            additionalAmount: true,
          },
        },
        additionalCosts: {
          select: {
            amount: true,
          },
        },
      },
    });
    const cost = latestShipment?.costs[0] ?? null;
    const additionalAmount =
      latestShipment && latestShipment.additionalCosts.length > 0
        ? latestShipment.additionalCosts.reduce(
            (total, entry) => total + Number(entry.amount),
            0,
          )
        : Number(cost?.additionalAmount ?? 0);
    const totalCosts =
      Number(cost?.purchaseAmount ?? 0) +
      Number(cost?.shippingAmount ?? 0) +
      additionalAmount;

    return retainedAmount - totalCosts;
  }

  private formatCurrencyAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  }

  private validatePaymentMethodForStatus(
    status: string,
    paymentMethod?: OrderPaymentMethod | string | null,
  ): void {
    if (OrdersService.paymentRequiredStatuses.has(status)) {
      if (!paymentMethod) {
        throw new BadRequestException(
          'Payment method is required when the order status is partially paid or confirmed.',
        );
      }

      return;
    }

    if (paymentMethod) {
      throw new BadRequestException(
        'Payment method can only be set when the order status is partially paid or confirmed.',
      );
    }
  }

  private async createWithGeneratedOrderNumber(
    createOrderDto: CreateOrderDto,
    normalizedStatus: OrderStatus,
    user: AuthenticatedUser,
  ) {
    for (let attempt = 1; attempt <= OrdersService.maxOrderNumberAttempts; attempt += 1) {
      try {
        return await this.prismaService.$transaction(
          async (transactionClient) => {
            const orderNumber =
              await this.ordersRepository.getNextOrderNumber(transactionClient);
            const createPayload = {
              ...createOrderDto,
              advisorName: user.name,
              orderNumber,
              status: normalizedStatus,
              totalSaleAmount: new Prisma.Decimal(createOrderDto.total),
            };
            const createdOrder = await this.ordersRepository.createWithTransaction(
              transactionClient,
              createPayload,
              user.userId,
            );

            if (createOrderDto.leadId) {
              await this.leadsRepository.markAsConvertedWithTransaction(
                transactionClient,
                createOrderDto.leadId,
                createdOrder.id,
              );
            }

            return createdOrder;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (
          attempt < OrdersService.maxOrderNumberAttempts &&
          this.shouldRetryOrderNumberGeneration(error)
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException('Unable to generate a unique order number.');
  }

  private shouldRetryOrderNumberGeneration(error: unknown): boolean {
    if (error instanceof ConflictException) {
      return true;
    }

    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    );
  }

  private buildOrderUpdateHistoryMessage(
    existingOrder: {
      customerName: string;
      partDescription: string;
      customerEmail: string | null;
      customerPhone: string | null;
      price: Prisma.Decimal | number;
      quantity: number;
      totalSaleAmount: Prisma.Decimal | number;
      currency: string;
      status: string;
      paymentMethod: string | null;
      intakeDetails: Prisma.JsonValue;
    },
    updateOrderDto: UpdateOrderDto,
  ): string | null {
    const changeLines: string[] = [];
    const nextCustomerEmail = this.normalizeNullableText(
      updateOrderDto.customerEmail ?? existingOrder.customerEmail,
    );
    const nextCustomerPhone = this.normalizeNullableText(
      updateOrderDto.customerPhone ?? existingOrder.customerPhone,
    );
    const nextQuantity = updateOrderDto.quantity ?? existingOrder.quantity;

    this.pushChangeLine(
      changeLines,
      'Customer name',
      existingOrder.customerName,
      updateOrderDto.customerName ?? existingOrder.customerName,
    );
    this.pushChangeLine(
      changeLines,
      'Part description',
      existingOrder.partDescription,
      updateOrderDto.partDescription ?? existingOrder.partDescription,
    );

    this.pushChangeLine(
      changeLines,
      'Customer email',
      existingOrder.customerEmail,
      nextCustomerEmail,
    );
    this.pushChangeLine(
      changeLines,
      'Customer phone',
      existingOrder.customerPhone,
      nextCustomerPhone,
    );
    this.pushChangeLine(
      changeLines,
      'Quantity',
      String(existingOrder.quantity),
      String(nextQuantity),
    );
    this.pushChangeLine(
      changeLines,
      'Sale price',
      String(existingOrder.price),
      String(updateOrderDto.price ?? existingOrder.price),
    );
    this.pushChangeLine(
      changeLines,
      'Total',
      String(existingOrder.totalSaleAmount),
      String(updateOrderDto.total ?? existingOrder.totalSaleAmount),
    );
    this.pushChangeLine(
      changeLines,
      'Currency',
      existingOrder.currency,
      updateOrderDto.currency ?? existingOrder.currency,
    );
    this.pushChangeLine(
      changeLines,
      'Status',
      existingOrder.status,
      updateOrderDto.status ?? existingOrder.status,
    );
    this.pushChangeLine(
      changeLines,
      'Payment method',
      existingOrder.paymentMethod,
      updateOrderDto.paymentMethod !== undefined
        ? updateOrderDto.paymentMethod
        : existingOrder.paymentMethod,
    );

    const intakeDetails = this.normalizeIntakeDetails(existingOrder.intakeDetails);
    for (const [field, label] of Object.entries(OrdersService.intakeHistoryLabels)) {
      const nextValue = updateOrderDto[field as keyof UpdateOrderDto];
      if (nextValue !== undefined) {
        this.pushChangeLine(
          changeLines,
          label,
          this.stringifyHistoryValue(intakeDetails[field]),
          this.stringifyHistoryValue(nextValue),
        );
      }
    }

    if (changeLines.length === 0) {
      return null;
    }

    return `Order updated:\n${changeLines.join('\n')}`;
  }

  private pushChangeLine(
    changeLines: string[],
    label: string,
    previousValue: string | null | undefined,
    nextValue: string | null | undefined,
  ): void {
    const normalizedPrevious = this.normalizeNullableText(previousValue);
    const normalizedNext = this.normalizeNullableText(nextValue);

    if (normalizedPrevious === normalizedNext) {
      return;
    }

    changeLines.push(`- ${label}: ${normalizedPrevious} -> ${normalizedNext}`);
  }

  private normalizeNullableText(value: string | null | undefined): string {
    if (!value || value.trim().length === 0) {
      return 'Not set';
    }

    return value.trim();
  }

  private validateUpdateAccess(
    updateOrderDto: UpdateOrderDto,
    user: AuthenticatedUser,
  ): void {
    if (user.role === Role.ADMIN) {
      return;
    }

    const salesFields = new Set(['customerEmail', 'customerPhone', 'note']);
    const restrictedField = Object.entries(updateOrderDto).find(
      ([field, value]) => value !== undefined && !salesFields.has(field),
    );

    if (restrictedField) {
      throw new BadRequestException(
        'Sales users can only update customer contact details and notes.',
      );
    }
  }

  private normalizeIntakeDetails(value: Prisma.JsonValue): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private stringifyHistoryValue(value: unknown): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return String(value);
  }

  private assertPastOrTodayDate(value: string, message: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Date value is invalid.');
    }

    if (value > getPacificTodayDateInputValue()) {
      throw new BadRequestException(message);
    }
  }

  private static readonly intakeHistoryLabels: Record<string, string> = {
    advisorName: 'Advisor name',
    orderDate: 'Order date',
    vehicleMake: 'Vehicle make',
    vehicleModel: 'Vehicle model',
    vehicleYear: 'Vehicle year',
    vehicleVariant: 'Vehicle variant',
    vehicleVin: 'VIN',
    vehicleNotes: 'Part description',
    vehicleConfiguration: 'Vehicle configuration',
    billingAddress: 'Billing address',
    billingPerson: 'Billing person',
    billingPhone: 'Billing phone',
    shippingAddress: 'Shipping address',
    shippingPerson: 'Shipping person',
    shippingPhone: 'Shipping phone',
    shippingAt: 'Shipping date',
    companyName: 'Company name',
    milesOffered: 'Miles offered',
    basePrice: 'Base price',
    salesTax: 'Sales tax',
    shippingCharges: 'Shipping charges',
    profit: 'Profit',
    partialPayment: 'Paid',
    cancellationReason: 'Cancellation reason',
    cancelledAt: 'Cancelled at',
    refundType: 'Refund type',
    refundDeductionAmount: 'Refund deduction amount',
    refundDeductionReason: 'Refund deduction reason',
    refundedAt: 'Refunded at',
  };

  private async afterMutation(
    orderId: string,
    action: 'created' | 'updated',
  ): Promise<void> {
    await this.ordersCacheService.invalidateList();
    void this.ordersJobsService.enqueueLifecycleEvent(orderId, action);
  }
}
