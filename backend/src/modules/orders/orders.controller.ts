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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UuidParamDto } from '../../common/dto/uuid-param.dto';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@Roles(Role.ADMIN, Role.SALES)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.create(createOrderDto, user);
  }

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Get()
  findAll(
    @Query() queryOrdersDto: QueryOrdersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.findAll(queryOrdersDto, user);
  }

  @Get('next-number')
  getNextOrderNumber() {
    return this.ordersService.getNextOrderNumber();
  }

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Get(':id')
  findOne(
    @Param() params: UuidParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.findOne(params.id, user);
  }

  @Patch(':id')
  update(
    @Param() params: UuidParamDto,
    @Body() updateOrderDto: UpdateOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ordersService.update(params.id, updateOrderDto, user);
  }
}
