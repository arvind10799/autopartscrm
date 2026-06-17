import { z, type ZodTypeAny } from 'zod';

export function createValidatedEnv<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: Record<string, unknown>,
  label: string,
): z.output<TSchema> {
  const parsed = schema.safeParse(input);

  if (parsed.success) {
    return parsed.data;
  }

  const issues = parsed.error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'value';
      return `${path}: ${issue.message}`;
    })
    .join('; ');

  throw new Error(`Invalid ${label} environment configuration. ${issues}`);
}
