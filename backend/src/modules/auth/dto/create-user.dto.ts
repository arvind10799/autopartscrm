import {
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsEnum(Role)
  @IsIn([Role.SALES, Role.SHIPPING], {
    message:
      'Only sales agents and shipping accounts can be created from the admin workspace.',
  })
  role: Role;
}
