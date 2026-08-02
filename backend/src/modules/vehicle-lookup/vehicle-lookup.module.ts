import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VehicleLookupController } from './vehicle-lookup.controller';
import { VehicleLookupService } from './vehicle-lookup.service';

@Module({
  imports: [AuthModule],
  controllers: [VehicleLookupController],
  providers: [VehicleLookupService],
})
export class VehicleLookupModule {}

