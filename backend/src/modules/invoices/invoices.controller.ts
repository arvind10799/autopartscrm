import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UuidParamDto } from '../../common/dto/uuid-param.dto';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoicesService } from './invoices.service';

@Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('orders/:id/invoice')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get('defaults')
  getDefaults(
    @Param() params: UuidParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.getDefaults(params.id, user);
  }

  @Get()
  findByOrderId(
    @Param() params: UuidParamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.findByOrderId(params.id, user);
  }

  @Roles(Role.ADMIN, Role.SALES)
  @Post()
  create(
    @Param() params: UuidParamDto,
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.create(params.id, createInvoiceDto, user);
  }
}
