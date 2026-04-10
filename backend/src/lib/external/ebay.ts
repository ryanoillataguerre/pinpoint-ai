/**
 * eBay Browse API client for product search and pricing data.
 * Uses OAuth 2.0 Client Credentials flow.
 *
 * Requires EBAY_CLIENT_ID and EBAY_CLIENT_SECRET env vars.
 */

import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const EBAY_AUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_BROWSE_URL = "https://api.ebay.com/buy/browse/v1";
const EBAY_SANDBOX_AUTH_URL =
  "https://api.sandbox.ebay.com/identity/v1/oauth2/token";
const EBAY_SANDBOX_BROWSE_URL =
  "https://api.sandbox.ebay.com/buy/browse/v1";

const TOKEN_CACHE_KEY = "ebay:access_token";

function getConfig() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const useSandbox = process.env.EBAY_SANDBOX === "true";

  if (!clientId || !clientSecret) {
    throw new Error("EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are required");
  }

  return {
    clientId,
    clientSecret,
    authUrl: useSandbox ? EBAY_SANDBOX_AUTH_URL : EBAY_AUTH_URL,
    browseUrl: useSandbox ? EBAY_SANDBOX_BROWSE_URL : EBAY_BROWSE_URL,
  };
}

export interface EbaySearchResult {
  title: string;
  price: { value: string; currency: string };
  condition: string;
  itemId: string;
  imageUrl: string | null;
  itemWebUrl: string;
  source: "ebay";
}

/**
 * Get an OAuth 2.0 access token for the eBay API.
 * Tokens are cached in Redis (eBay tokens last ~2 hours).
 */
async function getAccessToken(): Promise<string> {
  // Check cache first
  const cached = await redis.get(TOKEN_CACHE_KEY);
  if (cached) return cached;

  const { clientId, clientSecret, authUrl } = getConfig();

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const res = await fetch(authUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`eBay OAuth failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  // Cache with a buffer before expiry (subtract 5 minutes)
  const ttl = Math.max(data.expires_in - 300, 60);
  await redis.setex(TOKEN_CACHE_KEY, ttl, data.access_token);

  return data.access_token;
}

/**
 * Search eBay for products matching a query.
 */
export async function searchProducts(
  query: string,
  limit = 10
): Promise<EbaySearchResult[]> {
  const { browseUrl } = getConfig();
  const token = await getAccessToken();

  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(limit, 50)),
  });

  const res = await fetch(
    `${browseUrl}/item_summary/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.warn(`eBay search error (${res.status}): ${body}`);
    return [];
  }

  const data = (await res.json()) as {
    itemSummaries?: Array<{
      title: string;
      price: { value: string; currency: string };
      condition: string;
      itemId: string;
      image?: { imageUrl: string };
      itemWebUrl: string;
    }>;
    total: number;
  };

  if (!data.itemSummaries?.length) return [];

  return data.itemSummaries.map((item) => ({
    title: item.title,
    price: item.price,
    condition: item.condition || "Unknown",
    itemId: item.itemId,
    imageUrl: item.image?.imageUrl || null,
    itemWebUrl: item.itemWebUrl,
    source: "ebay" as const,
  }));
}

/**
 * Search eBay and return aggregate pricing data.
 * Useful for market value comparison.
 */
export async function getEbayPricing(
  query: string,
  limit = 20
): Promise<{
  avgPriceCents: number | null;
  lowestPriceCents: number | null;
  listingCount: number;
} | null> {
  try {
    const results = await searchProducts(query, limit);
    if (results.length === 0) return null;

    const prices = results
      .map((r) => Math.round(parseFloat(r.price.value) * 100))
      .filter((p) => !isNaN(p) && p > 0);

    if (prices.length === 0) return null;

    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const lowest = Math.min(...prices);

    return {
      avgPriceCents: avg,
      lowestPriceCents: lowest,
      listingCount: results.length,
    };
  } catch (err) {
    console.warn("eBay pricing aggregation failed:", err);
    return null;
  }
}

/**
 * Check if eBay credentials are configured.
 */
export function isConfigured(): boolean {
  return !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}
