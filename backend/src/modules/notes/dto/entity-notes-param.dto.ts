import { Transform } from 'class-transformer';
import { IsEnum, IsUUID } from 'class-validator';
import { NoteEntityType } from '../../../common/enums/note-entity-type.enum';
import {
  trimToUndefined,
  trimToUpperCase,
} from '../../../common/utils/transform.util';

export class EntityNotesParamDto {
  @Transform(({ value }) => trimToUpperCase(value))
  @IsEnum(NoteEntityType)
  entityType: NoteEntityType;

  @Transform(({ value }) => trimToUndefined(value))
  @IsUUID()
  entityId: string;
}
