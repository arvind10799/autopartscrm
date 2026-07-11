import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const prismaService = {
    $transaction: jest.fn(),
  };

  const ordersRepository = {
    create: jest.fn(),
    createWithTransaction: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findEditableById: jest.fn(),
    findSummaryById: jest.fn(),
    getNextOrderNumber: jest.fn(),
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

  const notificationsService = {
    notifyOrderCreated: jest.fn(),
    notifyOrderUpdated: jest.fn(),
  };

  const leadsRepository = {
    findConvertibleById: jest.fn(),
    markAsConvertedWithTransaction: jest.fn(),
  };

  const salesUser: AuthenticatedUser = {
    userId: 'sales-user-id',
    name: 'Sales User',
    email: 'sales@example.com',
    role: Role.SALES,
  };

  const adminUser: AuthenticatedUser = {
    userId: 'admin-user-id',
    name: 'Admin User',
    email: 'admin@example.com',
    role: Role.ADMIN,
  };

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    ordersCacheService.invalidateList.mockResolvedValue(undefined);
    ordersJobsService.enqueueLifecycleEvent.mockResolvedValue(undefined);
    notesService.create.mockResolvedValue(undefined);
    notificationsService.notifyOrderCreated.mockResolvedValue(undefined);
    notificationsService.notifyOrderUpdated.mockResolvedValue(undefined);
    service = new OrdersService(
      prismaService as never,
      ordersRepository as never,
      ordersCacheService as never,
      ordersJobsService as never,
      leadsRepository as never,
      notesService as never,
      notificationsService as never,
    );
  });

  it('rejects creating a confirmed order without a payment method', async () => {
    await expect(
      service.create(
        {
          advisorName: 'Sales User',
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

    expect(ordersRepository.createWithTransaction).not.toHaveBeenCalled();
  });

  it('rejects quantity changes for sales users', async () => {
    await expect(
      service.update(
        'order-id',
        {
          quantity: 4,
        },
        salesUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ordersRepository.findEditableById).not.toHaveBeenCalled();
    expect(ordersRepository.update).not.toHaveBeenCalled();
  });

  it('allows admins to edit order fields and records edit history', async () => {
    ordersRepository.findEditableById.mockResolvedValue({
      id: 'order-id',
      orderNumber: 'SO-1001',
      customerName: 'Metro Parts',
      partDescription: 'Brake pads',
      customerEmail: 'sales@metro.example',
      customerPhone: '1234567890',
      price: 100,
      quantity: 2,
      totalSaleAmount: 200,
      status: OrderStatus.DRAFT,
      paymentMethod: null,
      intakeDetails: {
        advisorName: 'Sales User',
      },
    });
    ordersRepository.update.mockResolvedValue(undefined);
    ordersRepository.findSummaryById.mockResolvedValue({ id: 'order-id' });

    const result = await service.update(
      'order-id',
      {
        customerName: 'Metro Auto Parts',
        advisorName: 'Admin User',
      },
      adminUser,
    );

    expect(ordersRepository.update).toHaveBeenCalledWith(
      'order-id',
      expect.objectContaining({
        customerName: 'Metro Auto Parts',
        advisorName: 'Admin User',
      }),
    );
    expect(notesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Customer name: Metro Parts -> Metro Auto Parts'),
      }),
      adminUser,
    );
    expect(notesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Advisor name: Sales User -> Admin User'),
      }),
      adminUser,
    );
    expect(notificationsService.notifyOrderUpdated).toHaveBeenCalledWith(
      'order-id',
      adminUser,
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
