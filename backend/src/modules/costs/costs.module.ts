import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CostsController } from './costs.controller';
import { CostsRepository } from './costs.repository';
import { CostsService } from './costs.service';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [CostsController],
  providers: [CostsService, CostsRepository],
  exports: [CostsService],
})
export class CostsModule {}
