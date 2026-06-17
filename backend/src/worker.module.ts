import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JobsWorkerModule } from './modules/jobs/jobs-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JobsWorkerModule,
  ],
})
export class WorkerModule {}
