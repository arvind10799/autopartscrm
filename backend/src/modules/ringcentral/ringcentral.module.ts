import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RingCentralController } from './ringcentral.controller';
import { RingCentralService } from './ringcentral.service';

@Module({
  imports: [ConfigModule, PrismaModule, NotificationsModule],
  controllers: [RingCentralController],
  providers: [RingCentralService],
})
export class RingCentralModule {}
