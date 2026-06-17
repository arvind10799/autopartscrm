import { z } from 'zod';
import { USER_ROLES } from '../types/auth.types';

export const userRoleSchema = z.enum(USER_ROLES);

export const authUserSchema = z.object({
  userId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  role: userRoleSchema,
});

export const authBackendSessionSchema = z.object({
  accessToken: z.string().trim().min(1),
  tokenType: z.literal('Bearer'),
  user: authUserSchema,
});

export const clientSessionSchema = z.object({
  user: authUserSchema,
});
