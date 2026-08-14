import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
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

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Post()
  create(
    @Param() params: UuidParamDto,
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.invoicesService.create(
      params.id,
      createInvoiceDto,
      user,
      this.resolveIpAddress(request),
    );
  }

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Patch()
  update(
    @Param() params: UuidParamDto,
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.invoicesService.update(
      params.id,
      createInvoiceDto,
      user,
      this.resolveIpAddress(request),
    );
  }

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Post('signature-request')
  resendSignatureRequest(
    @Param() params: UuidParamDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.invoicesService.resendSignatureRequest(
      params.id,
      user,
      this.resolveIpAddress(request),
    );
  }

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Post('signing-link')
  generateNewSigningLink(
    @Param() params: UuidParamDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.invoicesService.generateNewSigningLink(
      params.id,
      user,
      this.resolveIpAddress(request),
    );
  }

  @Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
  @Post('clone')
  cloneSignedInvoice(
    @Param() params: UuidParamDto,
    @Body() createInvoiceDto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.invoicesService.cloneSignedInvoice(
      params.id,
      createInvoiceDto,
      user,
      this.resolveIpAddress(request),
    );
  }

  private resolveIpAddress(request: Request): string | undefined {
    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim();
    }

    return request.ip;
  }
}
