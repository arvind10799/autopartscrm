import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  userId: string;
  name: string;
  email: string;
  role: Role;
}
