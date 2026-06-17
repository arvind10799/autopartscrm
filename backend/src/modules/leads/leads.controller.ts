import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { LeadsService } from './leads.service';

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
}
