import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import Redis from 'ioredis';
import { DEFAULT_CACHE_NAMESPACE_VERSION } from './redis.constants';
import { REDIS_CACHE_CLIENT } from './redis.constants';

@Injectable()
export class RedisCacheService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(
    @Inject(REDIS_CACHE_CLIENT)
    private readonly redisClient: Redis | null,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    if (this.redisClient === null) {
      return null;
    }

    try {
      await this.ensureConnected();

      const cachedValue = await this.redisClient.get(key);

      if (!cachedValue) {
        return null;
      }

      return JSON.parse(cachedValue) as T;
    } catch (error) {
      this.logWarning(`Failed to read cache key "${key}".`, error);

      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.redisClient === null) {
      return;
    }

    try {
      await this.ensureConnected();

      await this.redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logWarning(`Failed to write cache key "${key}".`, error);
    }
  }

  async remember<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cachedValue = await this.get<T>(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    const freshValue = await loader();
    await this.set(key, freshValue, ttlSeconds);

    return freshValue;
  }

  async getNamespaceVersion(namespace: string): Promise<number> {
    if (this.redisClient === null) {
      return DEFAULT_CACHE_NAMESPACE_VERSION;
    }

    const versionKey = this.getNamespaceVersionKey(namespace);

    try {
      await this.ensureConnected();
      await this.redisClient.set(versionKey, '1', 'NX');

      const rawVersion = await this.redisClient.get(versionKey);

      return this.parseVersion(rawVersion);
    } catch (error) {
      this.logWarning(
        `Failed to read cache namespace version for "${namespace}".`,
        error,
      );

      return DEFAULT_CACHE_NAMESPACE_VERSION;
    }
  }

  async bumpNamespaceVersion(namespace: string): Promise<number> {
    if (this.redisClient === null) {
      return DEFAULT_CACHE_NAMESPACE_VERSION;
    }

    const versionKey = this.getNamespaceVersionKey(namespace);

    try {
      await this.ensureConnected();
      await this.redisClient.set(versionKey, '1', 'NX');

      return await this.redisClient.incr(versionKey);
    } catch (error) {
      this.logWarning(
        `Failed to bump cache namespace version for "${namespace}".`,
        error,
      );

      return DEFAULT_CACHE_NAMESPACE_VERSION;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.redisClient === null || this.redisClient.status === 'end') {
      return;
    }

    try {
      await this.redisClient.quit();
    } catch (error) {
      this.logWarning('Failed to close Redis cache connection cleanly.', error);
      this.redisClient.disconnect(false);
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.redisClient === null) {
      return;
    }

    if (this.redisClient.status === 'wait') {
      await this.redisClient.connect();
    }
  }

  private getNamespaceVersionKey(namespace: string): string {
    return `cache:namespace:${namespace}:version`;
  }

  private parseVersion(rawVersion: string | null): number {
    const parsedVersion = Number(rawVersion);

    return Number.isInteger(parsedVersion) && parsedVersion > 0
      ? parsedVersion
      : DEFAULT_CACHE_NAMESPACE_VERSION;
  }

  private logWarning(message: string, error: unknown): void {
    const details = error instanceof Error ? error.message : String(error);

    this.logger.warn(`${message} ${details}`);
  }
}
