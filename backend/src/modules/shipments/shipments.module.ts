import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsRepository } from './shipments.repository';
import { ShipmentsService } from './shipments.service';

@Module({
  imports: [AuthModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, ShipmentsRepository],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
