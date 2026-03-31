import { Request, Response, NextFunction } from "express";
import { AppError } from "../../../shared/errors";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        name: err.name,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: {
      name: "InternalError",
      message: "An unexpected error occurred",
    },
  });
}
