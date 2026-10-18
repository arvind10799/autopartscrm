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
import { ConvertWebsiteLeadDto } from './dto/convert-website-lead.dto';
import { CreateWebsiteLeadNoteDto } from './dto/create-website-lead-note.dto';
import { QueryWebsiteLeadsDto } from './dto/query-website-leads.dto';
import { UpdateWebsiteLeadDto } from './dto/update-website-lead.dto';
import { WebsiteLeadsService } from './website-leads.service';

@Roles(Role.ADMIN, Role.SALES)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('website-leads')
export class WebsiteLeadsController {
  constructor(private readonly service: WebsiteLeadsService) {}

  @Get()
  list(
    @Query() query: QueryWebsiteLeadsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.list(query, user);
  }

  @Get('agents')
  agents() {
    return this.service.listAgents();
  }

  @Get(':id')
  get(@Param() params: UuidParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(params.id, user);
  }

  @Patch(':id')
  update(
    @Param() params: UuidParamDto,
    @Body() input: UpdateWebsiteLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(params.id, input, user);
  }

  @Get(':id/notes')
  notes(@Param() params: UuidParamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listNotes(params.id, user);
  }

  @Post(':id/notes')
  addNote(
    @Param() params: UuidParamDto,
    @Body() input: CreateWebsiteLeadNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addNote(params.id, input.content, user);
  }

  @Post(':id/convert')
  convert(
    @Param() params: UuidParamDto,
    @Body() input: ConvertWebsiteLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.convert(params.id, input, user);
  }
}
