import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { CostsService } from './costs.service';
import { CreateCostDto } from './dto/create-cost.dto';
import { ShipmentIdParamDto } from './dto/shipment-id-param.dto';
import { UpdateCostDto } from './dto/update-cost.dto';

@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('costs')
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Roles(Role.ADMIN, Role.SHIPPING)
  @Post()
  create(@Body() createCostDto: CreateCostDto) {
    return this.costsService.create(createCostDto);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Get('shipment/:shipmentId')
  findByShipmentId(@Param() params: ShipmentIdParamDto) {
    return this.costsService.findByShipmentId(params.shipmentId);
  }

  @Roles(Role.ADMIN, Role.SHIPPING)
  @Patch('shipment/:shipmentId')
  updateByShipmentId(
    @Param() params: ShipmentIdParamDto,
    @Body() updateCostDto: UpdateCostDto,
  ) {
    return this.costsService.updateByShipmentId(
      params.shipmentId,
      updateCostDto,
    );
  }
}
