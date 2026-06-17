import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { CreateShipmentEventDto } from './dto/create-shipment-event.dto';
import { ShipmentIdParamDto } from './dto/shipment-id-param.dto';
import { TrackingService } from './tracking.service';

@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Roles(Role.ADMIN, Role.SHIPPING)
  @Post()
  create(@Body() createShipmentEventDto: CreateShipmentEventDto) {
    return this.trackingService.create(createShipmentEventDto);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Get('shipment/:shipmentId/timeline')
  findTimelineByShipmentId(@Param() params: ShipmentIdParamDto) {
    return this.trackingService.findTimelineByShipmentId(params.shipmentId);
  }
}
