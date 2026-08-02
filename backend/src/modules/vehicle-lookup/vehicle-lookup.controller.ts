import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { VehicleLookupService } from './vehicle-lookup.service';

@Roles(Role.ADMIN, Role.SALES)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('vehicle-lookup')
export class VehicleLookupController {
  constructor(private readonly vehicleLookupService: VehicleLookupService) {}

  @Get('years')
  getYears() {
    return this.vehicleLookupService.getYears();
  }

  @Get('makes')
  getMakes(@Query('search') search?: string) {
    return this.vehicleLookupService.getMakes(search);
  }

  @Get('models')
  getModels(
    @Query('make') make = '',
    @Query('year') year?: string,
    @Query('search') search?: string,
  ) {
    return this.vehicleLookupService.getModels(make, year, search);
  }
}

