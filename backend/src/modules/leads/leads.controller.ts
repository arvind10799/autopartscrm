import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UuidParamDto } from '../../common/dto/uuid-param.dto';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';
import { XLSX_MIME_TYPE } from '../orders/orders-export-workbook.builder';

@Roles(Role.ADMIN, Role.SALES)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  create(
    @Body() createLeadDto: CreateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.create(createLeadDto, user);
  }

  @Get()
  findAll(
    @Query() queryLeadsDto: QueryLeadsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.findAll(queryLeadsDto, user);
  }

  @Get('agents')
  findLeadAgents() {
    return this.leadsService.findLeadAgents();
  }

  @Get('export.xlsx')
  async exportExcel(
    @Query() queryLeadsDto: QueryLeadsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const workbook = await this.leadsService.exportExcel(queryLeadsDto, user);

    response.setHeader('Content-Type', XLSX_MIME_TYPE);
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="leads-export.xlsx"',
    );
    response.send(workbook);
  }

  @Patch(':id')
  update(
    @Param() params: UuidParamDto,
    @Body() updateLeadDto: UpdateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.update(params.id, updateLeadDto, user);
  }
}
