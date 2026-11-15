import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { RemindersModule } from './reminders.module';
import { ReminderDeliveryService } from './reminder-delivery.service';
import { ReminderTransportService } from './reminder-transport.service';
@Module({
  imports: [PrismaModule, RemindersModule],
  providers: [ReminderDeliveryService, ReminderTransportService],
})
export class ReminderWorkerModule {}
