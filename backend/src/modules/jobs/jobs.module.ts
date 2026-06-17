import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createBullRedisConnection } from '../../infrastructure/redis/redis.config';
import { ORDERS_QUEUE_NAME } from './jobs.constants';
import { OrdersJobsService } from './orders-jobs.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: createBullRedisConnection(configService),
        prefix: configService.get<string>('BULLMQ_PREFIX', 'auto-parts-crm'),
        defaultJobOptions: {
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    }),
    BullModule.registerQueue({
      name: ORDERS_QUEUE_NAME,
    }),
  ],
  providers: [OrdersJobsService],
  exports: [BullModule, OrdersJobsService],
})
export class JobsModule {}
