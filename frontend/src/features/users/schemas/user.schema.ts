import { z } from 'zod';

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(120, 'Name must be 120 characters or less.'),
  email: z.string().trim().email('Enter a valid email address.'),
  role: z.enum(['SALES', 'SHIPPING']),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password is too long.'),
});

export type CreateUserSchema = z.infer<typeof createUserSchema>;

export const userRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['ADMIN', 'SALES', 'SHIPPING']),
  createdAt: z.string(),
});

export const userListSchema = z.array(userRecordSchema);
