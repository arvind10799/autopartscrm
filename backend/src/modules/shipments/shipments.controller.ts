import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UuidParamDto } from '../../common/dto/uuid-param.dto';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { QueryShipmentsDto } from './dto/query-shipments.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { ShipmentsService } from './shipments.service';

@Roles(Role.ADMIN, Role.SHIPPING)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  create(
    @Body() createShipmentDto: CreateShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shipmentsService.create(createShipmentDto, user);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Get()
  findAll(@Query() queryShipmentsDto: QueryShipmentsDto) {
    return this.shipmentsService.findAll(queryShipmentsDto);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Get(':id')
  findOne(@Param() params: UuidParamDto) {
    return this.shipmentsService.findOne(params.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param() params: UuidParamDto,
    @Body() updateShipmentStatusDto: UpdateShipmentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shipmentsService.updateStatus(
      params.id,
      updateShipmentStatusDto,
      user,
    );
  }
}
