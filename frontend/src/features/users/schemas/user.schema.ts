import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be 128 characters or fewer.');

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(120, 'Name must be 120 characters or less.'),
  email: z.string().trim().email('Enter a valid email address.'),
  role: z.enum(['SALES', 'SHIPPING']),
  password: passwordSchema,
});

export type CreateUserSchema = z.infer<typeof createUserSchema>;

export const updateUserPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type UpdateUserPasswordSchema = z.infer<
  typeof updateUserPasswordSchema
>;

export const updateUserPasswordPayloadSchema = z.object({
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  role: z.enum(['SALES', 'SHIPPING']).optional(),
});

export type UpdateUserSchema = z.infer<typeof updateUserSchema>;

export const userRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['ADMIN', 'SALES', 'SHIPPING']),
  createdAt: z.string(),
  status: z.literal('ACTIVE').optional().default('ACTIVE'),
});

export const userListSchema = z.array(userRecordSchema);
