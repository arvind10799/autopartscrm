import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { JobsOptions, Queue } from 'bullmq';
import {
  ORDER_LIFECYCLE_JOB_NAME,
  ORDERS_QUEUE_NAME,
  type OrderLifecycleAction,
  type OrderLifecycleJobPayload,
} from './jobs.constants';

const ORDER_LIFECYCLE_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

@Injectable()
export class OrdersJobsService {
  private readonly logger = new Logger(OrdersJobsService.name);

  constructor(
    @InjectQueue(ORDERS_QUEUE_NAME)
    private readonly ordersQueue: Queue<OrderLifecycleJobPayload>,
  ) {}

  async enqueueLifecycleEvent(
    orderId: string,
    action: OrderLifecycleAction,
  ): Promise<void> {
    try {
      await this.ordersQueue.add(
        ORDER_LIFECYCLE_JOB_NAME,
        {
          orderId,
          action,
          occurredAt: new Date().toISOString(),
        },
        ORDER_LIFECYCLE_JOB_OPTIONS,
      );
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);

      this.logger.warn(
        `Failed to enqueue order lifecycle job for order ${orderId}. ${details}`,
      );
    }
  }
}
