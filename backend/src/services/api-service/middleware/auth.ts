import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../../../shared/types";
import { UnauthorizedError } from "../../../shared/errors";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";

interface TokenPayload {
  userId: string;
  orgId?: string;
}

export function verifyToken(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token =
    req.headers["x-access-token"] as string | undefined;

  if (!token) {
    return next(new UnauthorizedError("No access token provided"));
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as TokenPayload;
    req.userId = decoded.userId;
    req.orgId = decoded.orgId;
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired access token"));
  }
}

export function verifyTokenOptional(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token =
    req.headers["x-access-token"] as string | undefined;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as TokenPayload;
    req.userId = decoded.userId;
    req.orgId = decoded.orgId;
  } catch {
    // Token invalid, but optional — continue without auth
  }

  next();
}
