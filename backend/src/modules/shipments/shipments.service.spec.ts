import { BadRequestException } from '@nestjs/common';
import { ShipmentStatus as PrismaShipmentStatus } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CACHE_NAMESPACE_ORDERS_LIST } from '../../infrastructure/redis/redis.constants';
import { ShipmentsService } from './shipments.service';

describe('ShipmentsService', () => {
  const shippingUser: AuthenticatedUser = {
    userId: 'shipping-user-id',
    name: 'Shipping User',
    email: 'shipping@example.com',
    role: Role.SHIPPING,
  };

  const shipmentsRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };

  const prismaService = {
    order: {
      findUnique: jest.fn(),
    },
  };

  const redisCacheService = {
    bumpNamespaceVersion: jest.fn(),
  };

  const notificationsService = {
    notifyShipmentCreated: jest.fn(),
    notifyShipmentStatusUpdated: jest.fn(),
  };

  const notesService = {
    create: jest.fn(),
  };

  let service: ShipmentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationsService.notifyShipmentCreated.mockResolvedValue(undefined);
    notificationsService.notifyShipmentStatusUpdated.mockResolvedValue(undefined);
    notesService.create.mockResolvedValue(undefined);
    service = new ShipmentsService(
      shipmentsRepository as never,
      prismaService as never,
      redisCacheService as never,
      notificationsService as never,
      notesService as never,
    );
  });

  it('creates a shipment for an order without an existing shipment', async () => {
    prismaService.order.findUnique.mockResolvedValue({
      id: 'order-id',
      status: 'DRAFT',
      _count: {
        shipments: 0,
      },
    });
    shipmentsRepository.create.mockResolvedValue({
      id: 'shipment-id',
      bolNumber: 'BOL-123',
      orderId: 'order-id',
      status: PrismaShipmentStatus.PENDING,
    });

    const result = await service.create(
      {
        bolNumber: 'BOL-123',
        orderId: 'order-id',
      },
      shippingUser,
    );

    expect(result).toEqual({
      id: 'shipment-id',
      bolNumber: 'BOL-123',
      orderId: 'order-id',
      status: PrismaShipmentStatus.PENDING,
    });
    expect(shipmentsRepository.create).toHaveBeenCalledWith({
      bolNumber: 'BOL-123',
      orderId: 'order-id',
    });
    expect(redisCacheService.bumpNamespaceVersion).toHaveBeenCalledWith(
      CACHE_NAMESPACE_ORDERS_LIST,
    );
    expect(notesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Shipment status updated:'),
        entityId: 'order-id',
        entityType: 'ORDER',
      }),
      shippingUser,
    );
    expect(notificationsService.notifyShipmentCreated).toHaveBeenCalledWith(
      'shipment-id',
    );
  });

  it('rejects shipment creation when the order already has a shipment', async () => {
    prismaService.order.findUnique.mockResolvedValue({
      id: 'order-id',
      status: 'PARTIALLY_PAID',
      _count: {
        shipments: 1,
      },
    });

    await expect(
      service.create(
        {
          bolNumber: 'BOL-123',
          orderId: 'order-id',
        },
        shippingUser,
      ),
    ).rejects.toThrow('A shipment has already been created for this order.');

    expect(shipmentsRepository.create).not.toHaveBeenCalled();
  });

  it('requires a PRO number when moving a shipment to in transit', async () => {
    shipmentsRepository.findOne.mockResolvedValue({
      id: 'shipment-id',
      orderId: 'order-id',
      status: PrismaShipmentStatus.SHIPPED,
      proNumber: null,
      shippedAt: new Date('2026-08-22T10:00:00.000Z'),
    });

    await expect(
      service.updateStatus(
        'shipment-id',
        {
          status: PrismaShipmentStatus.IN_TRANSIT,
        },
        shippingUser,
      ),
    ).rejects.toThrow(
      'PRO number is required when moving shipment to in transit.',
    );

    expect(shipmentsRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('sets the PRO number when moving a shipment to in transit', async () => {
    shipmentsRepository.findOne.mockResolvedValue({
      id: 'shipment-id',
      orderId: 'order-id',
      status: PrismaShipmentStatus.SHIPPED,
      proNumber: null,
      shippedAt: new Date('2026-08-22T10:00:00.000Z'),
    });
    shipmentsRepository.updateStatus.mockResolvedValue({
      id: 'shipment-id',
      orderId: 'order-id',
      bolNumber: 'BOL-123',
      status: PrismaShipmentStatus.IN_TRANSIT,
      proNumber: 'PRO-456',
    });

    const result = await service.updateStatus(
      'shipment-id',
      {
        status: PrismaShipmentStatus.IN_TRANSIT,
        proNumber: 'PRO-456',
      },
      shippingUser,
    );

    expect(result).toEqual({
      id: 'shipment-id',
      orderId: 'order-id',
      bolNumber: 'BOL-123',
      status: PrismaShipmentStatus.IN_TRANSIT,
      proNumber: 'PRO-456',
    });
    expect(shipmentsRepository.updateStatus).toHaveBeenCalledWith(
      'shipment-id',
      expect.objectContaining({
        status: PrismaShipmentStatus.IN_TRANSIT,
        proNumber: 'PRO-456',
      }),
    );
    expect(shipmentsRepository.updateStatus).toHaveBeenCalledWith(
      'shipment-id',
      expect.objectContaining({
        shippedAt: undefined,
      }),
    );
    expect(notificationsService.notifyShipmentStatusUpdated).toHaveBeenCalledWith(
      'shipment-id',
      PrismaShipmentStatus.SHIPPED,
      PrismaShipmentStatus.IN_TRANSIT,
    );
    expect(notesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Shipped -> In Transit'),
        entityId: 'order-id',
        entityType: 'ORDER',
      }),
      shippingUser,
    );
  });
});
