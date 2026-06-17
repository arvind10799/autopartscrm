import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });
  const logger = new Logger('BullWorkerBootstrap');

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal}. Shutting down worker context.`);
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  logger.log('BullMQ worker context started.');
}

void bootstrap();
