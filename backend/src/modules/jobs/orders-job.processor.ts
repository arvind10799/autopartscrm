import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  ORDER_LIFECYCLE_JOB_NAME,
  ORDERS_QUEUE_NAME,
  type OrderLifecycleJobPayload,
} from './jobs.constants';

@Processor(ORDERS_QUEUE_NAME, { concurrency: 5 })
export class OrdersJobProcessor extends WorkerHost {
  private readonly logger = new Logger(OrdersJobProcessor.name);

  process(job: Job<OrderLifecycleJobPayload>): Promise<void> {
    switch (job.name) {
      case ORDER_LIFECYCLE_JOB_NAME:
        this.logger.log(
          `Processed ${job.name} job for order ${job.data.orderId} (${job.data.action}).`,
        );
        return Promise.resolve();
      default:
        this.logger.warn(`Received unsupported job "${job.name}".`);
        return Promise.resolve();
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OrderLifecycleJobPayload> | undefined, error: Error): void {
    this.logger.error(
      `Job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      error.stack,
    );
  }
}
