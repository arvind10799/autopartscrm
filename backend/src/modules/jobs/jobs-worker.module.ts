import { Module } from '@nestjs/common';
import { JobsModule } from './jobs.module';
import { OrdersJobProcessor } from './orders-job.processor';

@Module({
  imports: [JobsModule],
  providers: [OrdersJobProcessor],
})
export class JobsWorkerModule {}
