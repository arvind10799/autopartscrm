import { NotFoundException } from '@nestjs/common';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import type { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

describe('Order billing state at lead conversion', () => {
  const user: AuthenticatedUser = {
    userId: 'sales-id',
    name: 'Sales',
    email: 'sales@example.test',
    role: Role.SALES,
  };
  let service: OrdersService;
  const transaction = {};
  const orders = {
    getNextOrderNumber: jest.fn(),
    createWithTransaction: jest.fn(),
  };
  const leads = {
    findConvertibleById: jest.fn(),
    markAsConvertedWithTransaction: jest.fn(),
  };
  const input: CreateOrderDto = {
    leadId: 'lead-id',
    advisorName: 'Sales',
    orderNumber: 'MAP11222601',
    orderDate: '2026-01-01',
    customerName: 'Synthetic customer',
    partDescription: 'Synthetic part',
    price: 100,
    quantity: 1,
    total: 100,
    status: OrderStatus.DRAFT,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    orders.getNextOrderNumber.mockResolvedValue('MAP11222601');
    orders.createWithTransaction.mockResolvedValue({ id: 'order-id' });
    leads.markAsConvertedWithTransaction.mockResolvedValue(undefined);
    service = new OrdersService(
      {
        $transaction: (fn: (tx: unknown) => unknown) => fn(transaction),
      } as never,
      orders as never,
      { invalidateList: jest.fn() } as never,
      { enqueueLifecycleEvent: jest.fn() } as never,
      leads as never,
      { create: jest.fn() } as never,
      { notifyOrderCreated: jest.fn() } as never,
    );
  });

  it.each([
    ['TX', 'TX'],
    [' texas ', 'TX'],
    ['AZ', 'AZ'],
    ['New York', 'NY'],
    [null, null],
    ['Unknown', null],
  ])(
    'inherits and normalizes lead state %s when billing state is omitted',
    async (state, expected) => {
      leads.findConvertibleById.mockResolvedValue({ id: 'lead-id', state });
      await service.create(input, user);
      expect(leads.findConvertibleById).toHaveBeenCalledWith('lead-id', user);
      expect(orders.createWithTransaction).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({ billingState: expected }),
        user.userId,
      );
      expect(leads.markAsConvertedWithTransaction).toHaveBeenCalledWith(
        transaction,
        'lead-id',
        'order-id',
        true,
      );
      expect(input).not.toHaveProperty('billingState');
    },
  );

  it.each(['CA', '', null])(
    'preserves an explicit billing state %s',
    async (billingState) => {
      leads.findConvertibleById.mockResolvedValue({
        id: 'lead-id',
        state: 'TX',
      });
      await service.create({ ...input, billingState }, user);
      expect(orders.createWithTransaction).toHaveBeenCalledWith(
        transaction,
        expect.objectContaining({ billingState }),
        user.userId,
      );
    },
  );

  it('does not read or inherit a lead state for a standalone order', async () => {
    await service.create({ ...input, leadId: undefined }, user);
    expect(leads.findConvertibleById).not.toHaveBeenCalled();
    expect(
      orders.createWithTransaction.mock.calls[0][1].billingState,
    ).toBeUndefined();
  });

  it('does not create an order when the caller cannot access the lead', async () => {
    leads.findConvertibleById.mockRejectedValue(
      new NotFoundException('Lead was not found.'),
    );
    await expect(service.create(input, user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(orders.createWithTransaction).not.toHaveBeenCalled();
  });
});
