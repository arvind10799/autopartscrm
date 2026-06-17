import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const ordersRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findEditableById: jest.fn(),
    findSummaryById: jest.fn(),
    update: jest.fn(),
  };

  const ordersCacheService = {
    rememberList: jest.fn(),
    invalidateList: jest.fn(),
  };

  const ordersJobsService = {
    enqueueLifecycleEvent: jest.fn(),
  };

  const notesService = {
    create: jest.fn(),
  };

  const salesUser: AuthenticatedUser = {
    userId: 'sales-user-id',
    name: 'Sales User',
    email: 'sales@example.com',
    role: Role.SALES,
  };

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    ordersCacheService.invalidateList.mockResolvedValue(undefined);
    ordersJobsService.enqueueLifecycleEvent.mockResolvedValue(undefined);
    notesService.create.mockResolvedValue(undefined);
    service = new OrdersService(
      ordersRepository as never,
      ordersCacheService as never,
      ordersJobsService as never,
      notesService as never,
    );
  });

  it('rejects creating a confirmed order without a payment method', async () => {
    await expect(
      service.create(
        {
          orderNumber: 'SO-1001',
          orderDate: '2026-05-27',
          customerName: 'Metro Parts',
          partDescription: 'Brake pads',
          price: 100,
          quantity: 2,
          total: 200,
          status: OrderStatus.CONFIRMED,
        },
        salesUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ordersRepository.create).not.toHaveBeenCalled();
  });

  it('records quantity changes as edit history and returns the refreshed summary', async () => {
    ordersRepository.findEditableById.mockResolvedValue({
      id: 'order-id',
      orderNumber: 'SO-1001',
      customerEmail: 'sales@metro.example',
      customerPhone: '1234567890',
      price: 100,
      quantity: 2,
    });
    ordersRepository.update.mockResolvedValue(undefined);
    ordersRepository.findSummaryById.mockResolvedValue({ id: 'order-id' });

    const result = await service.update(
      'order-id',
      {
        quantity: 4,
      },
      salesUser,
    );

    expect(ordersRepository.update).toHaveBeenCalledWith(
      'order-id',
      expect.objectContaining({
        quantity: 4,
      }),
    );
    expect(notesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Quantity: 2 -> 4'),
      }),
      salesUser,
    );
    expect(result).toEqual({ id: 'order-id' });
  });

  it('allows adding only a note without changing order fields', async () => {
    ordersRepository.findEditableById.mockResolvedValue({
      id: 'order-id',
      orderNumber: 'SO-1001',
      customerEmail: 'sales@metro.example',
      customerPhone: '1234567890',
      price: 100,
      quantity: 2,
    });
    ordersRepository.findSummaryById.mockResolvedValue({ id: 'order-id' });

    const result = await service.update(
      'order-id',
      {
        note: 'Customer requested evening delivery updates.',
      },
      salesUser,
    );

    expect(ordersRepository.update).not.toHaveBeenCalled();
    expect(notesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Customer requested evening delivery updates.',
      }),
      salesUser,
    );
    expect(result).toEqual({ id: 'order-id' });
  });
});
