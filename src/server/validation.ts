import { z } from 'zod';

export const sessionIdSchema = z.string().regex(/^ses_[a-zA-Z0-9]+$/, 'Invalid session ID format');

export const partIdSchema = z.string().min(1, 'Part ID required');

export const pollQuerySchema = z.object({
  sessionId: sessionIdSchema.optional(),
});

export function validateParam<T>(schema: z.ZodSchema<T>, value: unknown): T {
  return schema.parse(value);
}
