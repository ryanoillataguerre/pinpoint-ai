/**
 * Keepa API client for Amazon pricing and product data.
 * https://keepa.com/#!discuss/t/using-the-api/47
 *
 * Requires KEEPA_API_KEY env var. Each request costs tokens.
 */

const KEEPA_BASE = "https://api.keepa.com";

interface KeepaProduct {
  asin: string;
  title: string;
  brand: string;
  categoryTree?: Array<{ name: string; catId: number }>;
  imagesCSV: string;
  stats?: {
    current?: number[];
    avg30?: number[];
    avg90?: number[];
  };
  salesRankReference?: number;
  salesRanks?: Record<string, number[]>;
  offers?: Array<{
    sellerId: string;
    offerCSV: number[];
    isPrime: boolean;
  }>;
}

interface KeepaSearchResponse {
  products: KeepaProduct[];
  totalResults: number;
}

interface KeepaProductResponse {
  products: KeepaProduct[];
}

export interface KeepaProductResult {
  asin: string;
  title: string;
  brand: string;
  category: string | null;
  imageUrl: string | null;
  source: "keepa";
}

export interface KeepaRichPricingData {
  asin: string;
  buyBoxPriceCents: number | null;
  avg30DayPriceCents: number | null;
  avg90DayPriceCents: number | null;
  lowestPriceCents: number | null;
  soldLastMonth: number | null;
  totalOffers: number | null;
  bsrCategory: string | null;
  bsrRank: number | null;
  rawKeepaData: object;
}

function getApiKey(): string {
  const key = process.env.KEEPA_API_KEY;
  if (!key) throw new Error("KEEPA_API_KEY not configured");
  return key;
}

async function keepaFetch<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T | null> {
  const searchParams = new URLSearchParams({
    key: getApiKey(),
    ...params,
  });

  try {
    const res = await fetch(`${KEEPA_BASE}${endpoint}?${searchParams}`);
    if (!res.ok) {
      console.warn(`Keepa error ${res.status}: ${res.statusText}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("Keepa fetch error:", err);
    return null;
  }
}

/**
 * Convert Keepa price format (price * 100 in their format) to cents.
 * Keepa stores prices as integers where -1 = unavailable.
 */
function keepaPriceToCents(value: number | undefined): number | null {
  if (value === undefined || value < 0) return null;
  return value; // Keepa already stores in cents
}

function extractImageUrl(imagesCSV: string | undefined): string | null {
  if (!imagesCSV) return null;
  const firstImage = imagesCSV.split(",")[0];
  return firstImage
    ? `https://images-na.ssl-images-amazon.com/images/I/${firstImage}`
    : null;
}

export async function searchProducts(
  query: string,
  domain = 1 // 1 = Amazon.com
): Promise<KeepaProductResult[]> {
  const data = await keepaFetch<KeepaSearchResponse>("/search", {
    domain: String(domain),
    type: "product",
    term: query,
  });

  if (!data?.products?.length) return [];

  return data.products.slice(0, 10).map((p) => ({
    asin: p.asin,
    title: p.title,
    brand: p.brand,
    category:
      p.categoryTree?.map((c) => c.name).join(" > ") || null,
    imageUrl: extractImageUrl(p.imagesCSV),
    source: "keepa" as const,
  }));
}

export async function getProductByAsin(
  asin: string,
  domain = 1
): Promise<KeepaProductResult | null> {
  const data = await keepaFetch<KeepaProductResponse>("/product", {
    domain: String(domain),
    asin,
    stats: "1",
    offers: "20",
  });

  if (!data?.products?.length) return null;

  const p = data.products[0];
  return {
    asin: p.asin,
    title: p.title,
    brand: p.brand,
    category:
      p.categoryTree?.map((c) => c.name).join(" > ") || null,
    imageUrl: extractImageUrl(p.imagesCSV),
    source: "keepa",
  };
}

export async function getProductPricing(
  asin: string,
  domain = 1
): Promise<KeepaRichPricingData | null> {
  const data = await keepaFetch<KeepaProductResponse>("/product", {
    domain: String(domain),
    asin,
    stats: "180",
    offers: "20",
    buybox: "1",
  });

  if (!data?.products?.length) return null;

  const p = data.products[0];
  const stats = p.stats;

  // Stats arrays: index 0 = Amazon, 1 = New 3rd party, 2 = Used, 18 = Buy Box
  const buyBox = stats?.current?.[18];
  const avg30 = stats?.avg30?.[18];
  const avg90 = stats?.avg90?.[18];
  const lowest = stats?.current?.[1]; // lowest new 3rd party

  // BSR
  const salesRankEntries = p.salesRanks
    ? Object.entries(p.salesRanks)
    : [];
  const primaryBsr = salesRankEntries[0];

  return {
    asin,
    buyBoxPriceCents: keepaPriceToCents(buyBox),
    avg30DayPriceCents: keepaPriceToCents(avg30),
    avg90DayPriceCents: keepaPriceToCents(avg90),
    lowestPriceCents: keepaPriceToCents(lowest),
    soldLastMonth: null, // Requires Keepa premium data
    totalOffers: p.offers?.length ?? null,
    bsrCategory: primaryBsr
      ? p.categoryTree?.find((c) => String(c.catId) === primaryBsr[0])?.name ??
        null
      : null,
    bsrRank: primaryBsr
      ? primaryBsr[1][primaryBsr[1].length - 1] ?? null
      : null,
    rawKeepaData: p as object,
  };
}
