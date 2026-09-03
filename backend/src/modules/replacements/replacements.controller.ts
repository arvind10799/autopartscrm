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
import { CreateReplacementDto } from './dto/create-replacement.dto';
import { QueryReplacementsDto } from './dto/query-replacements.dto';
import { UpdateReplacementDto } from './dto/update-replacement.dto';
import { ReplacementsService } from './replacements.service';

@Roles(Role.ADMIN, Role.SALES, Role.SHIPPING)
@UseGuards(JwtAuthGuard, RoleGuard)
@Controller('replacements')
export class ReplacementsController {
  constructor(private readonly replacementsService: ReplacementsService) {}

  @Roles(Role.ADMIN, Role.SHIPPING)
  @Post()
  create(
    @Body() createReplacementDto: CreateReplacementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.replacementsService.create(createReplacementDto, user);
  }

  @Get()
  findAll(@Query() queryReplacementsDto: QueryReplacementsDto) {
    return this.replacementsService.findAll(queryReplacementsDto);
  }

  @Get(':id')
  findOne(@Param() params: UuidParamDto) {
    return this.replacementsService.findOne(params.id);
  }

  @Roles(Role.ADMIN, Role.SHIPPING)
  @Patch(':id')
  update(
    @Param() params: UuidParamDto,
    @Body() updateReplacementDto: UpdateReplacementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.replacementsService.update(
      params.id,
      updateReplacementDto,
      user,
    );
  }
}
