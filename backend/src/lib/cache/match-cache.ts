import Redis from "ioredis";
import crypto from "crypto";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const CACHE_TTL = 7 * 24 * 60 * 60; // 7 days

function buildCacheKey(
  normalizedDescription: string,
  brand?: string | null
): string {
  const input = `${(brand || "").toLowerCase().trim()}|${normalizedDescription.toLowerCase().trim()}`;
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return `match:${hash}`;
}

export interface CachedMatchResult {
  asin: string;
  upc?: string;
  title: string;
  brand?: string;
  confidence: number;
  source: string;
  cachedAt: string;
}

export async function getCachedMatch(
  normalizedDescription: string,
  brand?: string | null
): Promise<CachedMatchResult | null> {
  const key = buildCacheKey(normalizedDescription, brand);
  const cached = await redis.get(key);
  if (!cached) return null;
  return JSON.parse(cached);
}

export async function setCachedMatch(
  normalizedDescription: string,
  brand: string | null | undefined,
  result: CachedMatchResult
): Promise<void> {
  const key = buildCacheKey(normalizedDescription, brand);
  await redis.setex(key, CACHE_TTL, JSON.stringify(result));
}

export async function invalidateCachedMatch(
  normalizedDescription: string,
  brand?: string | null
): Promise<void> {
  const key = buildCacheKey(normalizedDescription, brand);
  await redis.del(key);
}
