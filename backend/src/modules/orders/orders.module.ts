import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { LeadsModule } from '../leads/leads.module';
import { NotesModule } from '../notes/notes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersCacheService } from './orders-cache.service';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, JobsModule, LeadsModule, NotesModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrdersCacheService],
  exports: [OrdersService],
})
export class OrdersModule {}
