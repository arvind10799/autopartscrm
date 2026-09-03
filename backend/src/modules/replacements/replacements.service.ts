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
    const replacementProNumber = this.normalizeOptionalText(
      createReplacementDto.replacementProNumber,
    );
    const replacementCarrierName = this.normalizeOptionalText(
      createReplacementDto.replacementCarrierName,
    );
    const replacementStatus =
      createReplacementDto.replacementStatus ?? ReplacementStatus.YARD_CONTACTED;

    if (!customerReason) {
      throw new BadRequestException('Customer reason is required.');
    }

    this.ensureTransitDetails(replacementStatus, {
      replacementProNumber,
      replacementCarrierName,
    });

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
      replacementProNumber,
      replacementCarrierName,
      createdById: user.userId,
    });

    await this.recordTrackingNotes({
      orderId: replacement.orderId,
      shipmentId: replacement.shipmentId,
      user,
      content: this.buildCreateNote({
        customerReason,
        yardUpdate,
        replacementStatus,
        replacementProNumber,
        replacementCarrierName,
      }),
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
    const replacementProNumber =
      updateReplacementDto.replacementProNumber !== undefined
        ? this.normalizeOptionalText(updateReplacementDto.replacementProNumber)
        : undefined;
    const replacementCarrierName =
      updateReplacementDto.replacementCarrierName !== undefined
        ? this.normalizeOptionalText(updateReplacementDto.replacementCarrierName)
        : undefined;
    const replacementStatus = updateReplacementDto.replacementStatus;

    if (customerReason !== undefined && !customerReason) {
      throw new BadRequestException('Customer reason cannot be blank.');
    }

    if (
      customerReason === undefined &&
      yardUpdate === undefined &&
      replacementStatus === undefined &&
      replacementProNumber === undefined &&
      replacementCarrierName === undefined
    ) {
      throw new BadRequestException(
        'At least one replacement field must be provided for update.',
      );
    }

    this.ensureTransitDetails(
      replacementStatus ?? (existingReplacement.replacementStatus as ReplacementStatus),
      {
        replacementProNumber:
          replacementProNumber !== undefined
            ? replacementProNumber
            : existingReplacement.replacementProNumber,
        replacementCarrierName:
          replacementCarrierName !== undefined
            ? replacementCarrierName
            : existingReplacement.replacementCarrierName,
      },
    );

    const summary = this.buildUpdateSummary(existingReplacement, {
      customerReason,
      yardUpdate,
      replacementStatus,
      replacementProNumber,
      replacementCarrierName,
    });

    if (!summary) {
      throw new BadRequestException('No replacement changes were detected.');
    }

    const replacement = await this.replacementsRepository.update(id, {
      customerReason,
      yardUpdate,
      replacementStatus:
        replacementStatus as unknown as PrismaReplacementStatus | undefined,
      replacementProNumber,
      replacementCarrierName,
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
        replacementProNumber:
          replacementProNumber !== undefined
            ? replacementProNumber
            : existingReplacement.replacementProNumber,
        replacementCarrierName:
          replacementCarrierName !== undefined
            ? replacementCarrierName
            : existingReplacement.replacementCarrierName,
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

  private buildCreateNote({
    customerReason,
    yardUpdate,
    replacementStatus,
    replacementProNumber,
    replacementCarrierName,
  }: {
    customerReason: string;
    yardUpdate: string | null;
    replacementStatus: ReplacementStatus;
    replacementProNumber: string | null;
    replacementCarrierName: string | null;
  }) {
    return [
      'Replacement request created:',
      `- Status: ${this.formatReplacementStatus(replacementStatus)}`,
      `- Customer reason: ${customerReason}`,
      ...(yardUpdate ? [`- Yard update: ${yardUpdate}`] : []),
      ...(replacementCarrierName
        ? [`- Freight carrier: ${replacementCarrierName}`]
        : []),
      ...(replacementProNumber ? [`- PRO number: ${replacementProNumber}`] : []),
    ].join('\n');
  }

  private buildUpdateSummary(
    existingReplacement: {
      customerReason: string;
      yardUpdate: string | null;
      replacementStatus: string;
      replacementProNumber: string | null;
      replacementCarrierName: string | null;
    },
    update: {
      customerReason?: string;
      yardUpdate?: string | null;
      replacementStatus?: ReplacementStatus;
      replacementProNumber?: string | null;
      replacementCarrierName?: string | null;
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

    if (
      update.replacementCarrierName !== undefined &&
      update.replacementCarrierName !== existingReplacement.replacementCarrierName
    ) {
      lines.push(
        `- Freight carrier: ${update.replacementCarrierName || 'Not set'}`,
      );
    }

    if (
      update.replacementProNumber !== undefined &&
      update.replacementProNumber !== existingReplacement.replacementProNumber
    ) {
      lines.push(`- PRO number: ${update.replacementProNumber || 'Not set'}`);
    }

    return lines.length > 0 ? lines.join('\n') : null;
  }

  private ensureTransitDetails(
    replacementStatus: ReplacementStatus,
    details: {
      replacementProNumber?: string | null;
      replacementCarrierName?: string | null;
    },
  ) {
    if (replacementStatus !== ReplacementStatus.IN_TRANSIT) {
      return;
    }

    if (!details.replacementCarrierName) {
      throw new BadRequestException(
        'Freight carrier is required when replacement status is in transit.',
      );
    }

    if (!details.replacementProNumber) {
      throw new BadRequestException(
        'PRO number is required when replacement status is in transit.',
      );
    }
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
