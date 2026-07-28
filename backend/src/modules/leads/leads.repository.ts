import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { buildCreatedAtFilter } from '../../common/utils/date-range.util';
import {
  createPaginatedResponse,
  getPaginationParams,
} from '../../common/utils/pagination.util';
import { handlePrismaError } from '../../common/utils/prisma-exception.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

const leadListSelect = {
  id: true,
  leadDate: true,
  adviserName: true,
  cmpt: true,
  customerPhone: true,
  customerName: true,
  customerEmail: true,
  state: true,
  partDescription: true,
  vehicleYear: true,
  vehicleMake: true,
  vehicleModel: true,
  vehicleVariant: true,
  quote: true,
  quoteCurrency: true,
  comments: true,
  prospects: true,
  status: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  convertedOrder: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
    },
  },
} satisfies Prisma.LeadSelect;

@Injectable()
export class LeadsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createLeadDto: CreateLeadDto, user: AuthenticatedUser) {
    try {
      return await this.prismaService.lead.create({
        data: {
          leadDate: new Date(createLeadDto.leadDate),
          adviserName: user.name,
          cmpt: createLeadDto.cmpt,
          customerPhone: createLeadDto.customerPhone.trim(),
          customerName: createLeadDto.customerName.trim(),
          customerEmail: createLeadDto.customerEmail,
          state: createLeadDto.state,
          partDescription: this.buildVehicleDescription(createLeadDto),
          vehicleYear: createLeadDto.vehicleYear.trim(),
          vehicleMake: createLeadDto.vehicleMake.trim(),
          vehicleModel: createLeadDto.vehicleModel.trim(),
          vehicleVariant: createLeadDto.vehicleVariant,
          quote:
            createLeadDto.quote !== undefined
              ? new Prisma.Decimal(createLeadDto.quote)
              : undefined,
          quoteCurrency: createLeadDto.quoteCurrency ?? 'USD',
          comments: createLeadDto.comments?.trim(),
          prospects: createLeadDto.prospects?.trim() ?? '',
          status: createLeadDto.status,
          createdBy: {
            connect: {
              id: user.userId,
            },
          },
        },
        select: leadListSelect,
      });
    } catch (error) {
      handlePrismaError(error, 'Lead');
    }
  }

  async findAll(queryLeadsDto: QueryLeadsDto, user: AuthenticatedUser) {
    const { page, limit, skip } = getPaginationParams(
      queryLeadsDto.page,
      queryLeadsDto.limit,
    );
    const where: Prisma.LeadWhereInput = this.buildLeadAccessWhere(user);
    const search = queryLeadsDto.search?.trim();
    const convertedFilter = this.normalizeConvertedFilter(queryLeadsDto.converted);
    const leadDateFilter = buildCreatedAtFilter(
      queryLeadsDto.createdFrom,
      queryLeadsDto.createdTo,
    );

    if (convertedFilter !== undefined) {
      where.convertedAt = convertedFilter ? { not: null } : null;
    }

    if (queryLeadsDto.status) {
      where.status = queryLeadsDto.status;
    }

    if (leadDateFilter) {
      where.leadDate = leadDateFilter;
    }

    if (search) {
      where.OR = [
        {
          adviserName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          cmpt: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          customerPhone: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          customerName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          customerEmail: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          state: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          partDescription: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          vehicleYear: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          vehicleMake: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          vehicleModel: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          vehicleVariant: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          prospects: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [data, total] = await this.prismaService.$transaction([
      this.prismaService.lead.findMany({
        where,
        select: leadListSelect,
        orderBy: [{ leadDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prismaService.lead.count({ where }),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async findConvertibleById(id: string, user: AuthenticatedUser) {
    const lead = await this.prismaService.lead.findFirst({
      where: {
        id,
        ...this.buildLeadAccessWhere(user),
      },
      select: {
        id: true,
        convertedAt: true,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead was not found.');
    }

    if (lead.convertedAt) {
      throw new BadRequestException('Lead has already been converted to an order.');
    }

    return lead;
  }

  async findEditableById(id: string, user: AuthenticatedUser) {
    const lead = await this.prismaService.lead.findFirst({
      where: {
        id,
        ...this.buildLeadAccessWhere(user),
      },
      select: {
        id: true,
        convertedAt: true,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead was not found.');
    }

    if (lead.convertedAt) {
      throw new BadRequestException(
        'Converted leads cannot be edited.',
      );
    }

    return lead;
  }

  async update(id: string, updateLeadDto: UpdateLeadDto) {
    try {
      const result = await this.prismaService.lead.updateMany({
        where: {
          id,
          convertedAt: null,
        },
        data: {
          leadDate: updateLeadDto.leadDate
            ? new Date(updateLeadDto.leadDate)
            : undefined,
          cmpt: updateLeadDto.cmpt,
          customerPhone: updateLeadDto.customerPhone,
          customerName: updateLeadDto.customerName,
          customerEmail: updateLeadDto.customerEmail,
          state: updateLeadDto.state,
          partDescription: this.shouldRefreshVehicleDescription(updateLeadDto)
            ? this.buildVehicleDescription(updateLeadDto)
            : undefined,
          vehicleYear: updateLeadDto.vehicleYear,
          vehicleMake: updateLeadDto.vehicleMake,
          vehicleModel: updateLeadDto.vehicleModel,
          vehicleVariant: updateLeadDto.vehicleVariant,
          quote:
            updateLeadDto.quote !== undefined
              ? new Prisma.Decimal(updateLeadDto.quote)
              : undefined,
          quoteCurrency: updateLeadDto.quoteCurrency,
          comments: updateLeadDto.comments,
          prospects: updateLeadDto.prospects,
          status: updateLeadDto.status,
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException('Converted leads cannot be edited.');
      }

      return await this.prismaService.lead.findUniqueOrThrow({
        where: { id },
        select: leadListSelect,
      });
    } catch (error) {
      handlePrismaError(error, 'Lead');
    }
  }

  async markAsConvertedWithTransaction(
    transactionClient: Prisma.TransactionClient,
    leadId: string,
    orderId: string,
  ) {
    const result = await transactionClient.lead.updateMany({
      where: {
        id: leadId,
        convertedOrderId: null,
      },
      data: {
        convertedOrderId: orderId,
        convertedAt: new Date(),
      },
    });

    if (result.count !== 1) {
      throw new BadRequestException(
        'Lead could not be converted because it was already converted.',
      );
    }
  }

  private buildLeadAccessWhere(user: AuthenticatedUser): Prisma.LeadWhereInput {
    if (user.role === Role.SALES) {
      return {
        createdById: user.userId,
      };
    }

    return {};
  }

  private normalizeConvertedFilter(value: unknown): boolean | undefined {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return undefined;
  }

  private buildVehicleDescription(
    leadDto: Pick<
      CreateLeadDto | UpdateLeadDto,
      'vehicleYear' | 'vehicleMake' | 'vehicleModel' | 'vehicleVariant'
    >,
  ): string {
    return [
      leadDto.vehicleYear,
      leadDto.vehicleMake,
      leadDto.vehicleModel,
      leadDto.vehicleVariant,
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .slice(0, 255);
  }

  private shouldRefreshVehicleDescription(updateLeadDto: UpdateLeadDto): boolean {
    return [
      updateLeadDto.vehicleYear,
      updateLeadDto.vehicleMake,
      updateLeadDto.vehicleModel,
      updateLeadDto.vehicleVariant,
    ].some((value) => value !== undefined);
  }
}
