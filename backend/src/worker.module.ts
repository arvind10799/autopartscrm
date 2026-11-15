import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JobsWorkerModule } from './modules/jobs/jobs-worker.module';
import { ReminderWorkerModule } from './modules/reminders/reminder-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    JobsWorkerModule,
    ReminderWorkerModule,
  ],
})
export class WorkerModule {}
