// Custom error class — lets us throw errors with HTTP status codes
// anywhere in the app and the error handler catches them cleanly

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguishes from unexpected crashes

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factories
export const NotFoundError = (resource = 'Resource') =>
  new AppError(`${resource} not found`, 404);

export const UnauthorizedError = (msg = 'Unauthorized') =>
  new AppError(msg, 401);

export const ForbiddenError = (msg = 'Forbidden') =>
  new AppError(msg, 403);

export const ConflictError = (msg: string) =>
  new AppError(msg, 409);
