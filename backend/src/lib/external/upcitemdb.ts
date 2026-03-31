/**
 * UPCitemdb API client — free tier: 100 requests/day
 * https://www.upcitemdb.com/wp/docs/main/development/responses/
 */

interface UpcItemDbItem {
  ean: string;
  title: string;
  upc: string;
  brand: string;
  category: string;
  asin: string;
  description: string;
  images: string[];
  offers: Array<{
    merchant: string;
    domain: string;
    title: string;
    price: string;
    link: string;
  }>;
}

interface UpcItemDbResponse {
  code: string;
  total: number;
  items: UpcItemDbItem[];
}

export interface UpcLookupResult {
  upc: string;
  title: string;
  brand: string;
  category: string;
  asin: string | null;
  imageUrl: string | null;
  source: "upcitemdb";
}

const BASE_URL = "https://api.upcitemdb.com/prod/trial/lookup";
const SEARCH_URL = "https://api.upcitemdb.com/prod/trial/search";

async function fetchUpcApi(
  url: string,
  params: Record<string, string>
): Promise<UpcItemDbResponse | null> {
  const searchParams = new URLSearchParams(params);
  try {
    const res = await fetch(`${url}?${searchParams}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn(`UPCitemdb error ${res.status}: ${res.statusText}`);
      return null;
    }

    return (await res.json()) as UpcItemDbResponse;
  } catch (err) {
    console.error("UPCitemdb fetch error:", err);
    return null;
  }
}

function mapItem(item: UpcItemDbItem): UpcLookupResult {
  return {
    upc: item.upc || item.ean,
    title: item.title,
    brand: item.brand,
    category: item.category,
    asin: item.asin || null,
    imageUrl: item.images?.[0] || null,
    source: "upcitemdb",
  };
}

export async function lookupByUpc(
  upc: string
): Promise<UpcLookupResult | null> {
  const data = await fetchUpcApi(BASE_URL, { upc });
  if (!data || data.total === 0 || !data.items?.length) return null;
  return mapItem(data.items[0]);
}

export async function searchByQuery(
  query: string
): Promise<UpcLookupResult[]> {
  const data = await fetchUpcApi(SEARCH_URL, { s: query, type: "product" });
  if (!data || !data.items?.length) return [];
  return data.items.slice(0, 10).map(mapItem);
}
