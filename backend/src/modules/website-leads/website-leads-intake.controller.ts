import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IntakeWebsiteLeadDto } from './dto/intake-website-lead.dto';
import { WebsiteLeadSignatureGuard } from './website-lead-signature.guard';
import { WebsiteLeadsService } from './website-leads.service';

@Controller('website-leads/intake')
@UseGuards(WebsiteLeadSignatureGuard)
export class WebsiteLeadsIntakeController {
  constructor(private readonly service: WebsiteLeadsService) {}

  @Post()
  async ingest(@Body() input: IntakeWebsiteLeadDto) {
    const lead = await this.service.ingest(input);
    return { id: lead.id, externalSubmissionId: lead.externalSubmissionId };
  }
}
