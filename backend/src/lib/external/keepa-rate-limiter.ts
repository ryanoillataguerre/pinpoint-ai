/**
 * Keepa API rate limiter with global rate limiting and per-org budget tracking.
 * Uses Redis for distributed rate limiting across workers.
 */

import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Global rate limits (configurable via env)
const GLOBAL_MAX_PER_MINUTE = parseInt(
  process.env.KEEPA_MAX_PER_MINUTE || "20",
  10
);
const GLOBAL_MAX_DAILY = parseInt(
  process.env.KEEPA_MAX_DAILY || "5000",
  10
);

// Per-org daily token limits by plan tier
const PLAN_TOKEN_LIMITS: Record<string, number> = {
  starter: 200,
  professional: 2000,
  enterprise: 10000,
};

// Token costs per Keepa operation type
export const KEEPA_TOKEN_COSTS = {
  search: 1,
  productDetail: 2,
  pricing: 2,
} as const;

export class KeepaRateLimitError extends Error {
  public retryable = true;
  constructor(message: string) {
    super(message);
    this.name = "KeepaRateLimitError";
  }
}

/**
 * Check if a Keepa request is allowed given global and per-org limits.
 * Returns true if the request can proceed.
 */
export async function acquireKeepaSlot(orgId: string): Promise<boolean> {
  // Check global per-minute limit (sliding window)
  const minuteKey = "keepa:global:minute";
  const now = Date.now();
  const windowStart = now - 60_000;

  const pipeline = redis.pipeline();
  // Remove entries older than 1 minute
  pipeline.zremrangebyscore(minuteKey, 0, windowStart);
  // Count entries in the current window
  pipeline.zcard(minuteKey);
  const results = await pipeline.exec();

  const currentMinuteCount = (results?.[1]?.[1] as number) || 0;
  if (currentMinuteCount >= GLOBAL_MAX_PER_MINUTE) {
    return false;
  }

  // Check global daily limit
  const dailyKey = `keepa:global:daily:${new Date().toISOString().slice(0, 10)}`;
  const dailyCount = parseInt((await redis.get(dailyKey)) || "0", 10);
  if (dailyCount >= GLOBAL_MAX_DAILY) {
    return false;
  }

  // Check per-org daily limit
  const orgDailyKey = `keepa:org:${orgId}:daily`;
  const orgDailyCount = parseInt((await redis.get(orgDailyKey)) || "0", 10);
  const orgLimit = await getOrgTokenLimit(orgId);
  if (orgDailyCount >= orgLimit) {
    return false;
  }

  // Record this request in the per-minute sliding window
  await redis.zadd(minuteKey, now, `${now}:${Math.random()}`);
  await redis.expire(minuteKey, 120);

  return true;
}

/**
 * Record Keepa token usage after a successful API call.
 */
export async function recordKeepaUsage(
  orgId: string,
  tokensUsed: number
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const pipeline = redis.pipeline();

  // Increment global daily counter
  const dailyKey = `keepa:global:daily:${today}`;
  pipeline.incrby(dailyKey, tokensUsed);
  pipeline.expire(dailyKey, 86400 * 2); // Expire after 2 days

  // Increment per-org daily counter
  const orgDailyKey = `keepa:org:${orgId}:daily`;
  pipeline.incrby(orgDailyKey, tokensUsed);
  pipeline.expire(orgDailyKey, 86400 * 2);

  await pipeline.exec();
}

/**
 * Get the Keepa token limit for an org based on its plan tier.
 */
async function getOrgTokenLimit(orgId: string): Promise<number> {
  // Check cached tier first
  const cacheKey = `keepa:org:${orgId}:tier`;
  const cachedTier = await redis.get(cacheKey);

  if (cachedTier) {
    return PLAN_TOKEN_LIMITS[cachedTier] || PLAN_TOKEN_LIMITS.starter;
  }

  // Fall back to DB lookup — will be set when org context is passed
  // For now, return starter limit as a safe default
  return PLAN_TOKEN_LIMITS.starter;
}

/**
 * Cache the org's plan tier in Redis for fast rate limit checks.
 * Called when we have Prisma context available.
 */
export async function cacheOrgTier(
  orgId: string,
  planTier: string
): Promise<void> {
  const cacheKey = `keepa:org:${orgId}:tier`;
  await redis.setex(cacheKey, 3600, planTier); // Cache for 1 hour
}

/**
 * Update the org's Keepa usage in the database for tracking/billing.
 * Called periodically or at end of batch.
 */
export async function syncOrgUsageToDb(
  prisma: PrismaClient,
  orgId: string
): Promise<void> {
  const orgDailyKey = `keepa:org:${orgId}:daily`;
  const tokensUsed = parseInt((await redis.get(orgDailyKey)) || "0", 10);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { keepaTokensResetAt: true },
  });

  if (!org) return;

  // Reset if more than 24 hours since last reset
  const resetThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (org.keepaTokensResetAt < resetThreshold) {
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        keepaTokensUsedToday: tokensUsed,
        keepaTokensResetAt: new Date(),
      },
    });
  } else {
    await prisma.organization.update({
      where: { id: orgId },
      data: { keepaTokensUsedToday: tokensUsed },
    });
  }
}

/**
 * Get current usage stats for an org (for API/UI).
 */
export async function getOrgKeepaUsage(orgId: string): Promise<{
  tokensUsedToday: number;
  dailyLimit: number;
}> {
  const orgDailyKey = `keepa:org:${orgId}:daily`;
  const tokensUsedToday = parseInt(
    (await redis.get(orgDailyKey)) || "0",
    10
  );
  const dailyLimit = await getOrgTokenLimit(orgId);

  return { tokensUsedToday, dailyLimit };
}
