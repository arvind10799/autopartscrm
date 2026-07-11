import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';
import { trimToLowerCaseEmail } from '../../../common/utils/transform.util';

export class UpdateUserDto {
  @Transform(({ value }) => trimToLowerCaseEmail(value))
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
