export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Unprocessable entity", details?: unknown) {
    super(message, 422, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429);
  }
}
