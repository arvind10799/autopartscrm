import { IsString, MinLength } from 'class-validator';

export class CustomerLookupQueryDto {
  @IsString()
  @MinLength(1)
  phone!: string;

  @IsString()
  @MinLength(1)
  token!: string;
}
