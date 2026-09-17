export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(options: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    if(options.details !== undefined) {
      this.details = options.details;
    }
  }
}

export function asSafeError(error: unknown): AppError {
  if(error instanceof AppError) {
    return error;
  }

  if(error instanceof Error && 'statusCode' in error &&
    typeof error.statusCode === 'number' && error.statusCode >= 400 &&
    error.statusCode < 500) {
    return new AppError({
      code: 'BAD_REQUEST',
      message: 'The request could not be parsed or accepted.',
      statusCode: error.statusCode
    });
  }

  return new AppError({
    code: 'INTERNAL_ERROR',
    message: 'The server could not complete the request.',
    statusCode: 500
  });
}
