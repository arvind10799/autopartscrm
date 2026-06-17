import { ConfigService } from '@nestjs/config';
import type { ConnectionOptions } from 'bullmq';
import type { RedisOptions } from 'ioredis';

const DEFAULT_REDIS_HOST = '127.0.0.1';
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_REDIS_DB = 0;

export function createRedisCacheOptions(
  configService: ConfigService,
): RedisOptions {
  return {
    ...getSharedRedisOptions(configService),
    keyPrefix: getOptionalString(configService, 'REDIS_CACHE_KEY_PREFIX'),
    connectTimeout: getNumber(configService, 'REDIS_CONNECT_TIMEOUT_MS', 5000),
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableReadyCheck: true,
    enableOfflineQueue: false,
  };
}

export function createBullRedisConnection(
  configService: ConfigService,
): ConnectionOptions {
  return {
    ...getSharedRedisOptions(configService),
    connectTimeout: getNumber(configService, 'REDIS_CONNECT_TIMEOUT_MS', 5000),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function isRedisCacheEnabled(configService: ConfigService): boolean {
  return isTrue(configService.get<string>('REDIS_CACHE_ENABLED', 'true'));
}

function getSharedRedisOptions(
  configService: ConfigService,
): Pick<
  RedisOptions,
  'host' | 'port' | 'username' | 'password' | 'db' | 'tls'
> {
  return {
    host: configService.get<string>('REDIS_HOST', DEFAULT_REDIS_HOST),
    port: getNumber(configService, 'REDIS_PORT', DEFAULT_REDIS_PORT),
    username: getOptionalString(configService, 'REDIS_USERNAME'),
    password: getOptionalString(configService, 'REDIS_PASSWORD'),
    db: getNumber(configService, 'REDIS_DB', DEFAULT_REDIS_DB),
    tls: isTrue(configService.get<string>('REDIS_TLS_ENABLED'))
      ? {}
      : undefined,
  };
}

function getNumber(
  configService: ConfigService,
  key: string,
  fallback: number,
): number {
  const rawValue = configService.get<string>(key);

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function getOptionalString(
  configService: ConfigService,
  key: string,
): string | undefined {
  const value = configService.get<string>(key)?.trim();

  return value ? value : undefined;
}

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}
