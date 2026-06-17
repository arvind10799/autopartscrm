import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisCacheService } from './redis-cache.service';
import { createRedisCacheOptions, isRedisCacheEnabled } from './redis.config';
import { REDIS_CACHE_CLIENT } from './redis.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CACHE_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisCacheClient');

        if (!isRedisCacheEnabled(configService)) {
          logger.log('Redis cache is disabled by configuration.');

          return null;
        }

        const redisClient = new Redis(createRedisCacheOptions(configService));

        redisClient.on('connect', () => {
          logger.log('Connected to Redis cache.');
        });

        redisClient.on('ready', () => {
          logger.log('Redis cache client is ready.');
        });

        redisClient.on('error', (error) => {
          logger.warn(`Redis cache error: ${error.message}`);
        });

        return redisClient;
      },
    },
    RedisCacheService,
  ],
  exports: [RedisCacheService],
})
export class RedisModule {}
