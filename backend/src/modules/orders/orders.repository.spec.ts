import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { OrdersRepository } from './orders.repository';

describe('OrdersRepository', () => {
  const salesUser: AuthenticatedUser = {
    userId: 'sales-user-id',
    name: 'Sales Agent',
    email: 'sales@example.com',
    role: Role.SALES,
  };

  const adminUser: AuthenticatedUser = {
    userId: 'admin-user-id',
    name: 'Admin User',
    email: 'admin@example.com',
    role: Role.ADMIN,
  };

  const prismaService = {
    order: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  let repository: OrdersRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new OrdersRepository(prismaService as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds the next MAP order number for the current day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T10:30:00.000Z'));
    prismaService.$queryRaw.mockResolvedValue([{ maxSuffix: 2 }]);

    await expect(repository.getNextOrderNumber()).resolves.toBe('MAP06152603');
  });

  it('starts the daily MAP sequence at 01 when no orders exist', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-16T10:30:00.000Z'));
    prismaService.$queryRaw.mockResolvedValue([{ maxSuffix: null }]);

    await expect(repository.getNextOrderNumber()).resolves.toBe('MAP06162601');
  });

  it('does not restrict order list for sales users without an agent filter', async () => {
    prismaService.order.findMany.mockReturnValue('findManyPromise');
    prismaService.order.count.mockReturnValue('countPromise');
    prismaService.$transaction.mockResolvedValue([[], 0]);

    await repository.findAll({}, salesUser);

    expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaService.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
    expect(prismaService.order.count).toHaveBeenCalledWith({
      where: {},
    });
  });

  it('filters order list by selected creator', async () => {
    prismaService.order.findMany.mockReturnValue('findManyPromise');
    prismaService.order.count.mockReturnValue('countPromise');
    prismaService.$transaction.mockResolvedValue([[], 0]);

    await repository.findAll({ createdById: 'other-sales-user-id' }, salesUser);

    expect(prismaService.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdById: 'other-sales-user-id',
        },
      }),
    );
    expect(prismaService.order.count).toHaveBeenCalledWith({
      where: {
        createdById: 'other-sales-user-id',
      },
    });
  });

  it('filters eligible shipment orders when hasShipment is false', async () => {
    prismaService.order.findMany.mockReturnValue('findManyPromise');
    prismaService.order.count.mockReturnValue('countPromise');
    prismaService.$transaction.mockResolvedValue([[], 0]);

    await repository.findAll({ hasShipment: false }, adminUser);

    expect(prismaService.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          shipments: {
            none: {},
          },
        },
      }),
    );
  });

  it('does not add creator filter for admin users', async () => {
    prismaService.order.findMany.mockReturnValue('findManyPromise');
    prismaService.order.count.mockReturnValue('countPromise');
    prismaService.$transaction.mockResolvedValue([[], 0]);

    await repository.findAll({}, adminUser);

    expect(prismaService.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('allows sales users to view order details across agents', async () => {
    prismaService.order.findFirst.mockResolvedValue({
      id: 'order-id',
    });

    await repository.findOne('order-id', salesUser);

    expect(prismaService.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'order-id',
        },
      }),
    );
  });

  it('restricts editable order lookup to the sales owner', async () => {
    prismaService.order.findFirst.mockResolvedValue({
      id: 'order-id',
      price: 10,
      quantity: 2,
    });

    await repository.findEditableById('order-id', salesUser);

    expect(prismaService.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'order-id',
          createdById: salesUser.userId,
        },
      }),
    );
  });
});
