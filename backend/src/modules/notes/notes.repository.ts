import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import { buildCreatedAtFilter } from '../../common/utils/date-range.util';
import { handlePrismaError } from '../../common/utils/prisma-exception.util';
import { PrismaService } from '../../database/prisma/prisma.service';
import { QueryNotesDto } from './dto/query-notes.dto';

const noteInclude = {
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
    },
  },
  shipment: {
    select: {
      id: true,
      proNumber: true,
      orderId: true,
    },
  },
} satisfies Prisma.NoteInclude;

type CreateNoteRecordInput = {
  authorId: string;
  content: string;
  entityId: string;
  entityType: NoteEntityType;
};

@Injectable()
export class NotesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async create({
    authorId,
    content,
    entityId,
    entityType,
  }: CreateNoteRecordInput) {
    try {
      return await this.prismaService.note.create({
        data: this.buildCreateData({
          authorId,
          content,
          entityId,
          entityType,
        }),
        include: noteInclude,
      });
    } catch (error) {
      handlePrismaError(error, 'Note');
    }
  }

  async findByEntity(
    entityType: NoteEntityType,
    entityId: string,
    queryNotesDto: QueryNotesDto,
  ) {
    const where = this.buildEntityWhere(entityType, entityId);
    const createdAtFilter = buildCreatedAtFilter(
      queryNotesDto.createdFrom,
      queryNotesDto.createdTo,
    );

    if (createdAtFilter) {
      where.createdAt = createdAtFilter;
    }

    return this.prismaService.note.findMany({
      where,
      include: noteInclude,
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
    });
  }

  async orderExists(id: string) {
    const order = await this.prismaService.order.findUnique({
      where: { id },
      select: { id: true },
    });

    return Boolean(order);
  }

  async shipmentExists(id: string) {
    const shipment = await this.prismaService.shipment.findUnique({
      where: { id },
      select: { id: true },
    });

    return Boolean(shipment);
  }

  private buildEntityWhere(
    entityType: NoteEntityType,
    entityId: string,
  ): Prisma.NoteWhereInput {
    switch (entityType) {
      case NoteEntityType.ORDER:
        return {
          entityType,
          orderId: entityId,
        };
      case NoteEntityType.SHIPMENT:
        return {
          entityType,
          shipmentId: entityId,
        };
      default:
        throw new BadRequestException('Unsupported note entity type.');
    }
  }

  private buildCreateData({
    authorId,
    content,
    entityId,
    entityType,
  }: CreateNoteRecordInput): Prisma.NoteCreateInput {
    switch (entityType) {
      case NoteEntityType.ORDER:
        return {
          content: content.trim(),
          entityType,
          author: {
            connect: {
              id: authorId,
            },
          },
          order: {
            connect: {
              id: entityId,
            },
          },
        };
      case NoteEntityType.SHIPMENT:
        return {
          content: content.trim(),
          entityType,
          author: {
            connect: {
              id: authorId,
            },
          },
          shipment: {
            connect: {
              id: entityId,
            },
          },
        };
      default:
        throw new BadRequestException('Unsupported note entity type.');
    }
  }
}
