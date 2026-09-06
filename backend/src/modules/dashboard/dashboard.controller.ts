import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { DashboardService } from './dashboard.service';
import { QueryAgentLeadsDashboardDto } from './dto/query-agent-leads-dashboard.dto';
import { QueryOrderStatusDashboardDto } from './dto/query-order-status-dashboard.dto';
import { QuerySalesOverviewDto } from './dto/query-sales-overview.dto';

@Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('sales-overview')
  getSalesOverview(@Query() query: QuerySalesOverviewDto) {
    return this.dashboardService.getSalesOverview(query);
  }

  @Get('order-status')
  getOrderStatus(@Query() query: QueryOrderStatusDashboardDto) {
    return this.dashboardService.getOrderStatus(query);
  }

  @Get('agent-leads')
  getAgentLeads(@Query() query: QueryAgentLeadsDashboardDto) {
    return this.dashboardService.getAgentLeads(query);
  }
}
