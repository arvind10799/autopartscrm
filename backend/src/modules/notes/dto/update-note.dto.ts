import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { trimToUndefined } from '../../../common/utils/transform.util';

export class UpdateNoteDto {
  @Transform(({ value }) => trimToUndefined(value))
  @IsOptional()
  @IsString()
  content?: string;
}
