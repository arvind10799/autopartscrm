import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import { OrderPaymentMethod } from '../../common/enums/order-payment-method.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { OrdersJobsService } from '../jobs/orders-jobs.service';
import { LeadsRepository } from '../leads/leads.repository';
import { NotesService } from '../notes/notes.service';
import { OrdersCacheService } from './orders-cache.service';
import { OrdersRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
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
  ) {}

  async create(createOrderDto: CreateOrderDto, user: AuthenticatedUser) {
    const normalizedStatus = createOrderDto.status ?? OrderStatus.DRAFT;

    this.validatePaymentMethodForStatus(
      normalizedStatus,
      createOrderDto.paymentMethod,
    );

    if (createOrderDto.leadId) {
      await this.leadsRepository.findConvertibleById(createOrderDto.leadId, user);
    }

    const createPayload = {
      ...createOrderDto,
      status: normalizedStatus,
      totalSaleAmount: new Prisma.Decimal(createOrderDto.total),
    };

    const order = createOrderDto.leadId
      ? await this.prismaService.$transaction(async (transactionClient) => {
          const createdOrder = await this.ordersRepository.createWithTransaction(
            transactionClient,
            createPayload,
            user.userId,
          );

          await this.leadsRepository.markAsConvertedWithTransaction(
            transactionClient,
            createOrderDto.leadId!,
            createdOrder.id,
          );

          return createdOrder;
        })
      : await this.ordersRepository.create(createPayload, user.userId);

    if (createOrderDto.note) {
      await this.notesService.create(
        {
          content: createOrderDto.note,
          entityType: NoteEntityType.ORDER,
          entityId: order.id,
        },
        user,
      );
    }

    await this.afterMutation(order.id, 'created');

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

  findOne(id: string, user: AuthenticatedUser) {
    return this.ordersRepository.findOne(id, user);
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

    const existingOrder = await this.ordersRepository.findEditableById(id, user);
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

    return this.ordersRepository.findSummaryById(id, user);
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

  private buildOrderUpdateHistoryMessage(
    existingOrder: {
      customerEmail: string | null;
      customerPhone: string | null;
      price: Prisma.Decimal | number;
      quantity: number;
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

  private async afterMutation(
    orderId: string,
    action: 'created' | 'updated',
  ): Promise<void> {
    await this.ordersCacheService.invalidateList();
    void this.ordersJobsService.enqueueLifecycleEvent(orderId, action);
  }
}
