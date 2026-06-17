import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CACHE_NAMESPACE_ORDERS_LIST } from '../../infrastructure/redis/redis.constants';
import { RedisCacheService } from '../../infrastructure/redis/redis-cache.service';
import { QueryOrdersDto } from './dto/query-orders.dto';

@Injectable()
export class OrdersCacheService {
  private readonly ordersListCacheTtlSeconds: number;

  constructor(
    private readonly redisCacheService: RedisCacheService,
    configService: ConfigService,
  ) {
    this.ordersListCacheTtlSeconds = this.resolveCacheTtlSeconds(configService);
  }

  async rememberList<T>(
    queryOrdersDto: QueryOrdersDto,
    user: AuthenticatedUser,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cacheKey = await this.buildOrdersListCacheKey(queryOrdersDto, user);

    return this.redisCacheService.remember(
      cacheKey,
      this.ordersListCacheTtlSeconds,
      loader,
    );
  }

  async invalidateList(): Promise<void> {
    await this.redisCacheService.bumpNamespaceVersion(
      CACHE_NAMESPACE_ORDERS_LIST,
    );
  }

  private async buildOrdersListCacheKey(
    queryOrdersDto: QueryOrdersDto,
    user: AuthenticatedUser,
  ): Promise<string> {
    const namespaceVersion = await this.redisCacheService.getNamespaceVersion(
      CACHE_NAMESPACE_ORDERS_LIST,
    );

    const normalizedQuery = {
      createdFrom: queryOrdersDto.createdFrom ?? null,
      createdTo: queryOrdersDto.createdTo ?? null,
      hasShipment: queryOrdersDto.hasShipment ?? null,
      limit: queryOrdersDto.limit ?? 20,
      orderNumber: queryOrdersDto.orderNumber?.trim() ?? null,
      page: queryOrdersDto.page ?? 1,
      role: user.role,
      search: queryOrdersDto.search?.trim() ?? null,
      status: queryOrdersDto.status ?? null,
      userId: user.userId,
    };

    const queryHash = createHash('sha256')
      .update(JSON.stringify(normalizedQuery))
      .digest('hex');

    return `orders:list:v${namespaceVersion}:${queryHash}`;
  }

  private resolveCacheTtlSeconds(configService: ConfigService): number {
    const rawTtl = Number(
      configService.get<string>('ORDERS_CACHE_TTL_SECONDS', '60'),
    );

    return Number.isFinite(rawTtl) && rawTtl > 0 ? rawTtl : 60;
  }
}
