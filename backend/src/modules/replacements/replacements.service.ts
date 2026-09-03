import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReplacementStatus as PrismaReplacementStatus } from '@prisma/client';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import { ReplacementStatus } from '../../common/enums/replacement-status.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CACHE_NAMESPACE_ORDERS_LIST } from '../../infrastructure/redis/redis.constants';
import { RedisCacheService } from '../../infrastructure/redis/redis-cache.service';
import { NotesService } from '../notes/notes.service';
import { CreateReplacementDto } from './dto/create-replacement.dto';
import { QueryReplacementsDto } from './dto/query-replacements.dto';
import { UpdateReplacementDto } from './dto/update-replacement.dto';
import { ReplacementsRepository } from './replacements.repository';

@Injectable()
export class ReplacementsService {
  constructor(
    private readonly replacementsRepository: ReplacementsRepository,
    private readonly notesService: NotesService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async create(
    createReplacementDto: CreateReplacementDto,
    user: AuthenticatedUser,
  ) {
    const customerReason = createReplacementDto.customerReason.trim();
    const yardUpdate = this.normalizeOptionalText(createReplacementDto.yardUpdate);
    const replacementStatus =
      createReplacementDto.replacementStatus ?? ReplacementStatus.REQUESTED;

    if (!customerReason) {
      throw new BadRequestException('Customer reason is required.');
    }

    await this.ensureRelatedRecords(
      createReplacementDto.orderId,
      createReplacementDto.shipmentId,
    );

    const replacement = await this.replacementsRepository.create({
      orderId: createReplacementDto.orderId,
      shipmentId: createReplacementDto.shipmentId,
      customerReason,
      yardUpdate,
      replacementStatus:
        replacementStatus as unknown as PrismaReplacementStatus,
      createdById: user.userId,
    });

    await this.recordTrackingNotes({
      orderId: replacement.orderId,
      shipmentId: replacement.shipmentId,
      user,
      content: this.buildCreateNote(customerReason, yardUpdate, replacementStatus),
    });

    await this.redisCacheService.bumpNamespaceVersion(
      CACHE_NAMESPACE_ORDERS_LIST,
    );

    return replacement;
  }

  findAll(queryReplacementsDto: QueryReplacementsDto) {
    return this.replacementsRepository.findAll(queryReplacementsDto);
  }

  findOne(id: string) {
    return this.replacementsRepository.findOne(id);
  }

  async update(
    id: string,
    updateReplacementDto: UpdateReplacementDto,
    user: AuthenticatedUser,
  ) {
    const existingReplacement = await this.replacementsRepository.findOne(id);
    const customerReason =
      updateReplacementDto.customerReason !== undefined
        ? updateReplacementDto.customerReason.trim()
        : undefined;
    const yardUpdate =
      updateReplacementDto.yardUpdate !== undefined
        ? this.normalizeOptionalText(updateReplacementDto.yardUpdate)
        : undefined;
    const replacementStatus = updateReplacementDto.replacementStatus;

    if (customerReason !== undefined && !customerReason) {
      throw new BadRequestException('Customer reason cannot be blank.');
    }

    if (
      customerReason === undefined &&
      yardUpdate === undefined &&
      replacementStatus === undefined
    ) {
      throw new BadRequestException(
        'At least one replacement field must be provided for update.',
      );
    }

    const summary = this.buildUpdateSummary(existingReplacement, {
      customerReason,
      yardUpdate,
      replacementStatus,
    });

    if (!summary) {
      throw new BadRequestException('No replacement changes were detected.');
    }

    const replacement = await this.replacementsRepository.update(id, {
      customerReason,
      yardUpdate,
      replacementStatus:
        replacementStatus as unknown as PrismaReplacementStatus | undefined,
      updatedById: user.userId,
      history: {
        action: 'UPDATED',
        summary,
        previousStatus:
          existingReplacement.replacementStatus as PrismaReplacementStatus,
        nextStatus:
          (replacementStatus as unknown as PrismaReplacementStatus | undefined) ??
          (existingReplacement.replacementStatus as PrismaReplacementStatus),
        customerReason:
          customerReason !== undefined
            ? customerReason
            : existingReplacement.customerReason,
        yardUpdate:
          yardUpdate !== undefined ? yardUpdate : existingReplacement.yardUpdate,
      },
    });

    await this.recordTrackingNotes({
      orderId: replacement.orderId,
      shipmentId: replacement.shipmentId,
      user,
      content: `Replacement updated:\n${summary}`,
    });

    await this.redisCacheService.bumpNamespaceVersion(
      CACHE_NAMESPACE_ORDERS_LIST,
    );

    return replacement;
  }

  private async ensureRelatedRecords(orderId: string, shipmentId?: string) {
    const orderExists = await this.replacementsRepository.orderExists(orderId);

    if (!orderExists) {
      throw new NotFoundException('Order was not found.');
    }

    if (!shipmentId) {
      return;
    }

    const shipmentBelongsToOrder =
      await this.replacementsRepository.shipmentBelongsToOrder(
        shipmentId,
        orderId,
      );

    if (!shipmentBelongsToOrder) {
      throw new BadRequestException(
        'Shipment must belong to the selected order.',
      );
    }
  }

  private async recordTrackingNotes({
    orderId,
    shipmentId,
    user,
    content,
  }: {
    orderId: string;
    shipmentId?: string | null;
    user: AuthenticatedUser;
    content: string;
  }) {
    const noteContent = this.truncateNoteContent(content);

    await this.notesService.create(
      {
        entityType: NoteEntityType.ORDER,
        entityId: orderId,
        content: noteContent,
      },
      user,
    );

    if (shipmentId) {
      await this.notesService.create(
        {
          entityType: NoteEntityType.SHIPMENT,
          entityId: shipmentId,
          content: noteContent,
        },
        user,
      );
    }
  }

  private buildCreateNote(
    customerReason: string,
    yardUpdate: string | null,
    replacementStatus: ReplacementStatus,
  ) {
    return [
      'Replacement request created:',
      `- Status: ${this.formatReplacementStatus(replacementStatus)}`,
      `- Customer reason: ${customerReason}`,
      ...(yardUpdate ? [`- Yard update: ${yardUpdate}`] : []),
    ].join('\n');
  }

  private buildUpdateSummary(
    existingReplacement: {
      customerReason: string;
      yardUpdate: string | null;
      replacementStatus: string;
    },
    update: {
      customerReason?: string;
      yardUpdate?: string | null;
      replacementStatus?: ReplacementStatus;
    },
  ) {
    const lines: string[] = [];

    if (
      update.replacementStatus &&
      update.replacementStatus !== existingReplacement.replacementStatus
    ) {
      lines.push(
        `- Status: ${this.formatReplacementStatus(
          existingReplacement.replacementStatus,
        )} -> ${this.formatReplacementStatus(update.replacementStatus)}`,
      );
    }

    if (
      update.customerReason !== undefined &&
      update.customerReason !== existingReplacement.customerReason
    ) {
      lines.push(`- Customer reason: ${update.customerReason}`);
    }

    if (
      update.yardUpdate !== undefined &&
      update.yardUpdate !== existingReplacement.yardUpdate
    ) {
      lines.push(`- Yard update: ${update.yardUpdate || 'Not set'}`);
    }

    return lines.length > 0 ? lines.join('\n') : null;
  }

  private normalizeOptionalText(value?: string): string | null {
    const trimmedValue = value?.trim();

    return trimmedValue ? trimmedValue : null;
  }

  private formatReplacementStatus(status: string) {
    return status
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private truncateNoteContent(content: string) {
    return content.length > 1000 ? `${content.slice(0, 997)}...` : content;
  }
}
