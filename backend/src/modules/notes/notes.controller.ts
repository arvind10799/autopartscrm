import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/role.guard';
import { CreateNoteDto } from './dto/create-note.dto';
import { EntityNotesParamDto } from './dto/entity-notes-param.dto';
import { QueryNotesDto } from './dto/query-notes.dto';
import { NotesService } from './notes.service';

@Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  create(
    @Body() createNoteDto: CreateNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notesService.create(createNoteDto, user);
  }

  @Get('entity/:entityType/:entityId')
  findByEntity(
    @Param() params: EntityNotesParamDto,
    @Query() queryNotesDto: QueryNotesDto,
  ) {
    return this.notesService.findByEntity(
      params.entityType,
      params.entityId,
      queryNotesDto,
    );
  }
}
