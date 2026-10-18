import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WebsiteLeadSignatureGuard } from './website-lead-signature.guard';
import { WebsiteLeadsController } from './website-leads.controller';
import { WebsiteLeadsIntakeController } from './website-leads-intake.controller';
import { WebsiteLeadsRepository } from './website-leads.repository';
import { WebsiteLeadsService } from './website-leads.service';

@Module({
  imports: [AuthModule],
  controllers: [WebsiteLeadsController, WebsiteLeadsIntakeController],
  providers: [
    WebsiteLeadsService,
    WebsiteLeadsRepository,
    WebsiteLeadSignatureGuard,
  ],
})
export class WebsiteLeadsModule {}
