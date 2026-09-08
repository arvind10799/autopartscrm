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

export const updateUserSchema = z
  .object({
    email: z.string().trim().email('Enter a valid email address.').optional(),
    role: z.enum(['SALES', 'SHIPPING']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (values) =>
      values.email !== undefined ||
      values.role !== undefined ||
      values.isActive !== undefined,
    'Email, role, or account status is required.',
  );

export type UpdateUserSchema = z.infer<typeof updateUserSchema>;

export const userRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(['ADMIN', 'SALES', 'SHIPPING']),
  isActive: z.boolean().optional().default(true),
  createdAt: z.string(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
}).transform((user) => ({
  ...user,
  status: user.isActive ? ('ACTIVE' as const) : ('DISABLED' as const),
}));

export const userListSchema = z.array(userRecordSchema);
