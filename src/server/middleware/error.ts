import type { Context, Next } from 'hono';

export interface ErrorResponse {
  error: string;
  message: string;
  status: number;
}

export async function errorHandler(c: Context, next: Next): Promise<Response | void> {
  try {
    await next();
  } catch (err) {
    console.error('Server error:', err);

    const error = err instanceof Error ? err : new Error('Unknown error');
    const status = 500;

    const response: ErrorResponse = {
      error: error.name,
      message: error.message,
      status,
    };

    return c.json(response, status);
  }
}

export function notFoundHandler(c: Context): Response {
  const response: ErrorResponse = {
    error: 'Not Found',
    message: `Route ${c.req.path} not found`,
    status: 404,
  };

  return c.json(response, 404);
}
