import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { OrdersCacheService } from './orders-cache.service';

describe('OrdersCacheService', () => {
  const redisCacheService = {
    remember: jest.fn(),
    getNamespaceVersion: jest.fn(),
    bumpNamespaceVersion: jest.fn(),
  };

  const configService = {
    get: jest.fn().mockReturnValue('60'),
  };

  const salesUserOne: AuthenticatedUser = {
    userId: 'sales-user-one',
    name: 'Sales One',
    email: 'sales1@example.com',
    role: Role.SALES,
  };

  const salesUserTwo: AuthenticatedUser = {
    userId: 'sales-user-two',
    name: 'Sales Two',
    email: 'sales2@example.com',
    role: Role.SALES,
  };

  let service: OrdersCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisCacheService.getNamespaceVersion.mockResolvedValue(1);
    redisCacheService.remember.mockImplementation(
      async (_key: string, _ttl: number, loader: () => Promise<unknown>) =>
        loader(),
    );
    service = new OrdersCacheService(
      redisCacheService as never,
      configService as never,
    );
  });

  it('uses different cache keys for different sales users', async () => {
    await service.rememberList({}, salesUserOne, async () => []);
    await service.rememberList({}, salesUserTwo, async () => []);

    const firstKey = redisCacheService.remember.mock.calls[0][0];
    const secondKey = redisCacheService.remember.mock.calls[1][0];

    expect(firstKey).not.toEqual(secondKey);
  });

  it('uses different cache keys when shipment eligibility filter changes', async () => {
    await service.rememberList({ hasShipment: false }, salesUserOne, async () => []);
    await service.rememberList({ hasShipment: true }, salesUserOne, async () => []);

    const firstKey = redisCacheService.remember.mock.calls[0][0];
    const secondKey = redisCacheService.remember.mock.calls[1][0];

    expect(firstKey).not.toEqual(secondKey);
  });
});
