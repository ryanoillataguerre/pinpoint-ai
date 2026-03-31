import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  orgId?: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface ApiResponse<T = unknown> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    name: string;
    message: string;
    details?: unknown;
  };
}
