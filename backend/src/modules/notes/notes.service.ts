import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { NoteEntityType } from '../../common/enums/note-entity-type.enum';
import { CACHE_NAMESPACE_ORDERS_LIST } from '../../infrastructure/redis/redis.constants';
import { RedisCacheService } from '../../infrastructure/redis/redis-cache.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { QueryNotesDto } from './dto/query-notes.dto';
import { NotesRepository } from './notes.repository';

@Injectable()
export class NotesService {
  constructor(
    private readonly notesRepository: NotesRepository,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async create(createNoteDto: CreateNoteDto, user: AuthenticatedUser) {
    await this.ensureEntityExists(
      createNoteDto.entityType,
      createNoteDto.entityId,
    );

    const note = await this.notesRepository.create({
      authorId: user.userId,
      content: createNoteDto.content,
      entityId: createNoteDto.entityId,
      entityType: createNoteDto.entityType,
    });

    if (createNoteDto.entityType === NoteEntityType.ORDER) {
      await this.redisCacheService.bumpNamespaceVersion(
        CACHE_NAMESPACE_ORDERS_LIST,
      );
    }

    return note;
  }

  async findByEntity(
    entityType: NoteEntityType,
    entityId: string,
    queryNotesDto: QueryNotesDto,
  ) {
    await this.ensureEntityExists(entityType, entityId);

    return this.notesRepository.findByEntity(
      entityType,
      entityId,
      queryNotesDto,
    );
  }

  private async ensureEntityExists(
    entityType: NoteEntityType,
    entityId: string,
  ) {
    switch (entityType) {
      case NoteEntityType.ORDER: {
        const exists = await this.notesRepository.orderExists(entityId);

        if (!exists) {
          throw new NotFoundException('Order was not found.');
        }

        return;
      }
      case NoteEntityType.SHIPMENT: {
        const exists = await this.notesRepository.shipmentExists(entityId);

        if (!exists) {
          throw new NotFoundException('Shipment was not found.');
        }

        return;
      }
      default:
        throw new BadRequestException('Unsupported note entity type.');
    }
  }
}
