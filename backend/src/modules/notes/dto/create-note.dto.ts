import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NoteEntityType } from '../../../common/enums/note-entity-type.enum';
import {
  trimString,
  trimToUpperCase,
  trimToUndefined,
} from '../../../common/utils/transform.util';

export class CreateNoteDto {
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;

  @Transform(({ value }) => trimToUpperCase(value))
  @IsEnum(NoteEntityType)
  entityType: NoteEntityType;

  @Transform(({ value }) => trimToUndefined(value))
  @IsUUID()
  entityId: string;
}
