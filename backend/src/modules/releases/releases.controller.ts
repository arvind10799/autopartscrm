import { Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReleasesService } from './releases.service';

@Controller('releases')
@UseGuards(JwtAuthGuard)
export class ReleasesController {
  constructor(private readonly releasesService: ReleasesService) {}

  @Get(':releaseId/seen')
  hasSeen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('releaseId') releaseId: string,
  ) {
    return this.releasesService.hasSeen(user.userId, releaseId);
  }

  @Put(':releaseId/seen')
  markSeen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('releaseId') releaseId: string,
  ) {
    return this.releasesService.markSeen(user.userId, releaseId);
  }
}
