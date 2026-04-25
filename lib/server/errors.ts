export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new ApiError(message, 400, 'bad_request');
export const unauthorized = (message: string) => new ApiError(message, 401, 'unauthorized');
export const notFound = (message: string) => new ApiError(message, 404, 'not_found');
