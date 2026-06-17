import type { UserRole } from '../types/auth.types';

export const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Admin',
  SALES: 'Sales',
  SHIPPING: 'Shipping',
};
