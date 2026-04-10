import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { TooManyRequestsError } from "../../../shared/errors";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export function rateLimit(config: RateLimitConfig) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // Use IP for unauthenticated, userId for authenticated
    const key = `${config.keyPrefix}:${(req as any).userId || req.ip}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.pexpire(key, config.windowMs);
      }

      if (current > config.maxRequests) {
        throw new TooManyRequestsError("Rate limit exceeded");
      }

      next();
    } catch (err) {
      if (err instanceof TooManyRequestsError) {
        next(err);
      } else {
        // Redis error — don't block the request
        next();
      }
    }
  };
}

// Pre-configured limiters
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20,
  keyPrefix: "rl:auth",
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyPrefix: "rl:api",
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyPrefix: "rl:upload",
});
