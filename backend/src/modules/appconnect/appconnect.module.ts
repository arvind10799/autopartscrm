import { Module } from '@nestjs/common';
import { RingCentralModule } from '../ringcentral/ringcentral.module';
import { AppConnectController } from './appconnect.controller';
import { AppConnectService } from './appconnect.service';

@Module({
  imports: [RingCentralModule],
  controllers: [AppConnectController],
  providers: [AppConnectService],
})
export class AppConnectModule {}
