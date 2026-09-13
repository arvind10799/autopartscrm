import { IsString, MinLength } from 'class-validator';

export class FindContactQueryDto {
  @IsString()
  @MinLength(1)
  phone!: string;
}
