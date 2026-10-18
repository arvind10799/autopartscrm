import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WebsiteLeadStatus } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { isFuturePacificDate } from '../../common/utils/pacific-date.util';
import { ConvertWebsiteLeadDto } from './dto/convert-website-lead.dto';
import { IntakeWebsiteLeadDto } from './dto/intake-website-lead.dto';
import { QueryWebsiteLeadsDto } from './dto/query-website-leads.dto';
import { UpdateWebsiteLeadDto } from './dto/update-website-lead.dto';
import { WebsiteLeadsRepository } from './website-leads.repository';

@Injectable()
export class WebsiteLeadsService {
  constructor(private readonly repository: WebsiteLeadsRepository) {}

  ingest(input: IntakeWebsiteLeadDto) {
    const page = new URL(input.sourcePageUrl);
    if (
      !['meeautoparts.com', 'www.meeautoparts.com'].includes(
        page.hostname.toLowerCase(),
      ) ||
      /(^|\/)auto-parts-support-contact(\/|$)/i.test(page.pathname)
    ) {
      throw new BadRequestException(
        'This website form is not enabled for CRM leads.',
      );
    }
    if (!input.customerPhone && !input.customerEmail) {
      throw new BadRequestException(
        'A phone number or email address is required.',
      );
    }
    if (new Date(input.submittedAt).getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException('Submission time is invalid.');
    }
    return this.repository.ingest(input);
  }

  list(query: QueryWebsiteLeadsDto, user: AuthenticatedUser) {
    return this.repository.list(query, user);
  }

  summary(user: AuthenticatedUser) {
    return this.repository.summary(user);
  }

  get(id: string, user: AuthenticatedUser) {
    return this.repository.findAccessible(id, user);
  }

  listAgents() {
    return this.repository.listAgents();
  }

  claim(id: string, user: AuthenticatedUser) {
    if (user.role !== Role.SALES) {
      throw new ForbiddenException('Only a sales agent can claim a website lead.');
    }
    return this.repository.claim(id, user);
  }

  async update(
    id: string,
    input: UpdateWebsiteLeadDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.repository.findAccessible(id, user);
    this.requireOwnership(existing.assignedToId, user);
    if (
      existing.convertedLeadId ||
      existing.status === WebsiteLeadStatus.CONVERTED
    ) {
      throw new BadRequestException(
        'Converted website leads cannot be edited.',
      );
    }
    if (input.status === WebsiteLeadStatus.CONVERTED) {
      throw new BadRequestException(
        'Use Convert to Lead to mark this inquiry converted.',
      );
    }
    if (input.assignedToId !== undefined) {
      if (user.role !== Role.ADMIN) {
        throw new ForbiddenException('Only an admin can assign website leads.');
      }
      if (
        input.assignedToId !== null &&
        !(await this.repository.isActiveAgent(input.assignedToId))
      ) {
        throw new BadRequestException(
          'Assigned agent must be active Admin or Sales.',
        );
      }
    }
    if (input.status === undefined && input.assignedToId === undefined) {
      throw new BadRequestException('No changes were provided.');
    }
    return this.repository.update(id, input, user);
  }

  async listNotes(id: string, user: AuthenticatedUser) {
    await this.repository.findAccessible(id, user);
    return this.repository.listNotes(id);
  }

  async addNote(id: string, content: string, user: AuthenticatedUser) {
    const existing = await this.repository.findAccessible(id, user);
    this.requireOwnership(existing.assignedToId, user);
    return this.repository.addNote(id, content, user);
  }

  async convert(
    id: string,
    input: ConvertWebsiteLeadDto,
    user: AuthenticatedUser,
  ) {
    const existing = await this.repository.findAccessible(id, user);
    this.requireOwnership(existing.assignedToId, user);
    if (isFuturePacificDate(input.leadDate)) {
      throw new BadRequestException('Lead date cannot be in the future.');
    }
    return this.repository.convert(id, input, user);
  }

  private requireOwnership(assignedToId: string | null, user: AuthenticatedUser) {
    if (user.role === Role.SALES && assignedToId !== user.userId) {
      throw new ForbiddenException(
        'Assign this website lead to yourself before editing it.',
      );
    }
  }
}
