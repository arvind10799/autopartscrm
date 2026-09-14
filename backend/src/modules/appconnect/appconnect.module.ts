import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { RingCentralModule } from '../ringcentral/ringcentral.module';
import { AppConnectController } from './appconnect.controller';
import { AppConnectService } from './appconnect.service';

@Module({
  imports: [PrismaModule, RingCentralModule],
  controllers: [AppConnectController],
  providers: [AppConnectService],
})
export class AppConnectModule {}
