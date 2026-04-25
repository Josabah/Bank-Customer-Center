import { ZodError, type ZodSchema } from 'zod';

import { ApiError } from './errors';

export async function readJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(error.issues[0]?.message ?? 'Invalid request body', 400, 'validation_error');
    }

    throw new ApiError('Invalid JSON request body', 400, 'invalid_json');
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status: error.status }
    );
  }

  console.error(error);

  return Response.json(
    {
      error: {
        code: 'internal_error',
        message: 'Something went wrong.',
      },
    },
    { status: 500 }
  );
}
