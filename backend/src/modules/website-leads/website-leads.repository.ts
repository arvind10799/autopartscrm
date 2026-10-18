import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role as PrismaRole, WebsiteLeadStatus } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { buildCreatedAtFilter } from '../../common/utils/date-range.util';
import {
  createPaginatedResponse,
  getPaginationParams,
} from '../../common/utils/pagination.util';
import { parsePacificDateInputValue } from '../../common/utils/pacific-date.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ConvertWebsiteLeadDto } from './dto/convert-website-lead.dto';
import { IntakeWebsiteLeadDto } from './dto/intake-website-lead.dto';
import { QueryWebsiteLeadsDto } from './dto/query-website-leads.dto';
import { UpdateWebsiteLeadDto } from './dto/update-website-lead.dto';

const websiteLeadInclude = {
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  convertedLead: { select: { id: true, customerName: true } },
} satisfies Prisma.WebsiteLeadInclude;

const noteInclude = {
  author: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.NoteInclude;

@Injectable()
export class WebsiteLeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(input: IntakeWebsiteLeadDto) {
    const where = {
      source_externalSubmissionId: {
        source: input.source,
        externalSubmissionId: input.externalSubmissionId,
      },
    };
    try {
      return await this.prisma.websiteLead.upsert({
        where,
        create: {
          ...input,
          submittedAt: new Date(input.submittedAt),
        },
        update: {},
        include: websiteLeadInclude,
      });
    } catch (error) {
      // Concurrent retries can race the unique index; both must resolve to one record.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.prisma.websiteLead.findUniqueOrThrow({
          where,
          include: websiteLeadInclude,
        });
      }
      throw error;
    }
  }

  async list(query: QueryWebsiteLeadsDto, user: AuthenticatedUser) {
    const { page, limit, skip } = getPaginationParams(query.page, query.limit);
    const where: Prisma.WebsiteLeadWhereInput = {
      AND: [this.visibleWhere(user), this.assignmentWhere(query, user)],
      status: query.status,
      submittedAt: buildCreatedAtFilter(query.createdFrom, query.createdTo),
      OR: query.search?.trim()
        ? [
            {
              customerName: {
                contains: query.search.trim(),
                mode: 'insensitive',
              },
            },
            { customerPhone: { contains: query.search.trim() } },
            {
              customerEmail: {
                contains: query.search.trim(),
                mode: 'insensitive',
              },
            },
            {
              partRequested: {
                contains: query.search.trim(),
                mode: 'insensitive',
              },
            },
            {
              vehicleMake: {
                contains: query.search.trim(),
                mode: 'insensitive',
              },
            },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.websiteLead.findMany({
        where,
        include: websiteLeadInclude,
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.websiteLead.count({ where }),
    ]);
    return createPaginatedResponse(items, total, page, limit);
  }

  async summary(user: AuthenticatedUser) {
    const visible = this.visibleWhere(user);
    const [totalCount, newCount, unassignedCount, mineCount] =
      await this.prisma.$transaction([
        this.prisma.websiteLead.count({ where: visible }),
        this.prisma.websiteLead.count({
          where: { AND: [visible, { status: WebsiteLeadStatus.NEW }] },
        }),
        this.prisma.websiteLead.count({
          where: { AND: [visible, { assignedToId: null }] },
        }),
        this.prisma.websiteLead.count({
          where: { AND: [visible, { assignedToId: user.userId }] },
        }),
      ]);
    return { totalCount, newCount, unassignedCount, mineCount };
  }

  async findAccessible(id: string, user: AuthenticatedUser) {
    const record = await this.prisma.websiteLead.findFirst({
      where: { id, AND: [this.visibleWhere(user)] },
      include: websiteLeadInclude,
    });
    if (!record) throw new NotFoundException('Website lead was not found.');
    return record;
  }

  async claim(id: string, user: AuthenticatedUser) {
    const claimed = await this.prisma.websiteLead.updateMany({
      where: {
        id,
        assignedToId: null,
        convertedLeadId: null,
        status: { not: WebsiteLeadStatus.CONVERTED },
      },
      data: { assignedToId: user.userId },
    });
    if (claimed.count !== 1) {
      throw new ConflictException(
        'This website lead is no longer available to claim. Refresh the list.',
      );
    }
    return this.prisma.websiteLead.findUniqueOrThrow({
      where: { id },
      include: websiteLeadInclude,
    });
  }

  listAgents() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [PrismaRole.ADMIN, PrismaRole.SALES] },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  async isActiveAgent(id: string) {
    return Boolean(
      await this.prisma.user.findFirst({
        where: {
          id,
          isActive: true,
          role: { in: [PrismaRole.ADMIN, PrismaRole.SALES] },
        },
        select: { id: true },
      }),
    );
  }

  async update(
    id: string,
    input: UpdateWebsiteLeadDto,
    user: AuthenticatedUser,
  ) {
    const result = await this.prisma.websiteLead.updateMany({
      where: {
        id,
        AND: [this.ownedWhere(user)],
        convertedLeadId: null,
        status: { not: WebsiteLeadStatus.CONVERTED },
      },
      data: {
        status: input.status,
        assignedToId: input.assignedToId,
      },
    });
    if (result.count !== 1)
      throw new ConflictException('Website lead can no longer be edited.');
    return this.prisma.websiteLead.findUniqueOrThrow({
      where: { id },
      include: websiteLeadInclude,
    });
  }

  async listNotes(id: string) {
    return this.prisma.note.findMany({
      where: { websiteLeadId: id, entityType: 'WEBSITE_LEAD' },
      include: noteInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async addNote(id: string, content: string, user: AuthenticatedUser) {
    return this.prisma.note.create({
      data: {
        content,
        entityType: 'WEBSITE_LEAD',
        authorId: user.userId,
        websiteLeadId: id,
      },
      include: noteInclude,
    });
  }

  async convert(
    id: string,
    input: ConvertWebsiteLeadDto,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const original = await tx.websiteLead.findUnique({
        where: { id },
        select: { convertedLeadId: true, status: true, assignedToId: true },
      });
      if (
        !original ||
        (user.role !== Role.ADMIN && original.assignedToId !== user.userId)
      ) {
        throw new NotFoundException('Website lead was not found.');
      }
      if (
        original.convertedLeadId ||
        original.status === WebsiteLeadStatus.CONVERTED
      ) {
        throw new ConflictException('Website lead has already been converted.');
      }

      const lead = await tx.lead.create({
        data: {
          leadDate: parsePacificDateInputValue(input.leadDate),
          adviserName: user.name,
          cmpt: input.cmpt,
          customerPhone: input.customerPhone,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          state: input.state,
          partDescription: [
            input.vehicleYear,
            input.vehicleMake,
            input.vehicleModel,
            input.vehicleVariant,
          ]
            .filter(Boolean)
            .join(' ')
            .slice(0, 255),
          vehicleYear: input.vehicleYear,
          vehicleMake: input.vehicleMake,
          vehicleModel: input.vehicleModel,
          vehicleVariant: input.vehicleVariant,
          quote:
            input.quote === undefined
              ? undefined
              : new Prisma.Decimal(input.quote),
          quoteCurrency: input.quoteCurrency ?? 'USD',
          comments: input.comments,
          prospects: input.prospects ?? '',
          status: input.status,
          createdById: user.userId,
        },
        select: { id: true, customerName: true },
      });

      const claimed = await tx.websiteLead.updateMany({
        where: {
          id,
          AND: [this.ownedWhere(user)],
          convertedLeadId: null,
          status: { not: WebsiteLeadStatus.CONVERTED },
        },
        data: {
          status: WebsiteLeadStatus.CONVERTED,
          convertedLeadId: lead.id,
          convertedById: user.userId,
          convertedAt: new Date(),
        },
      });
      if (claimed.count !== 1)
        throw new ConflictException('Website lead has already been converted.');

      if (input.comments?.trim()) {
        await tx.note.create({
          data: {
            content: input.comments.trim(),
            entityType: 'LEAD',
            leadId: lead.id,
            authorId: user.userId,
          },
        });
      }
      return tx.lead.findUniqueOrThrow({
        where: { id: lead.id },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
          convertedOrder: {
            select: { id: true, orderNumber: true, status: true },
          },
          websiteLead: { select: { id: true } },
        },
      });
    });
  }

  private visibleWhere(user: AuthenticatedUser): Prisma.WebsiteLeadWhereInput {
    return user.role === Role.ADMIN
      ? {}
      : {
          OR: [
            {
              assignedToId: null,
              status: { not: WebsiteLeadStatus.CONVERTED },
            },
            { assignedToId: user.userId },
          ],
        };
  }

  private ownedWhere(user: AuthenticatedUser): Prisma.WebsiteLeadWhereInput {
    return user.role === Role.ADMIN ? {} : { assignedToId: user.userId };
  }

  private assignmentWhere(
    query: QueryWebsiteLeadsDto,
    user: AuthenticatedUser,
  ): Prisma.WebsiteLeadWhereInput {
    if (query.assignment === 'UNASSIGNED') return { assignedToId: null };
    if (query.assignment === 'MINE') return { assignedToId: user.userId };
    if (user.role === Role.ADMIN && query.assignedToId) {
      return { assignedToId: query.assignedToId };
    }
    return {};
  }
}
