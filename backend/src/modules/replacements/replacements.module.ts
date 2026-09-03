import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotesModule } from '../notes/notes.module';
import { ReplacementsController } from './replacements.controller';
import { ReplacementsRepository } from './replacements.repository';
import { ReplacementsService } from './replacements.service';

@Module({
  imports: [AuthModule, NotesModule],
  controllers: [ReplacementsController],
  providers: [ReplacementsService, ReplacementsRepository],
})
export class ReplacementsModule {}
