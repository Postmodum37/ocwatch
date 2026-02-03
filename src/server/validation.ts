import { z, ZodError } from 'zod';
import type { Context } from 'hono';

export const sessionIdSchema = z.string().regex(/^ses_[a-zA-Z0-9]+$/, 'Invalid session ID format');

export const partIdSchema = z.string().min(1, 'Part ID required');

export const pollQuerySchema = z.object({
  sessionId: sessionIdSchema.optional(),
});

export function validateParam<T>(schema: z.ZodSchema<T>, value: unknown): T {
  return schema.parse(value);
}

export type ValidationResult<T> = { success: true; value: T } | { success: false; response: Response };

export function validateWithResponse<T>(
  schema: z.ZodSchema<T>,
  value: unknown,
  c: Context
): ValidationResult<T> {
  try {
    return { success: true, value: schema.parse(value) };
  } catch (e) {
    if (e instanceof ZodError) {
      return {
        success: false,
        response: c.json({ error: "VALIDATION_ERROR", message: e.message, status: 400 }, 400),
      };
    }
    throw e;
  }
}
