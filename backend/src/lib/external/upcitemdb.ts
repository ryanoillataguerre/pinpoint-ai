/**
 * UPCitemdb API client — free tier: 100 requests/day
 * https://www.upcitemdb.com/wp/docs/main/development/responses/
 */

interface UpcItemDbOffer {
  // "merchant": "Newegg.com",
  // "domain": "newegg.com",
  // "title": "Apple iPhone 6 64GB T-Mobile Space Gray MG5A2LL/A",
  // "currency": "string",
  // "list_price": 0,
  // "price": 1200,
  // "shipping": "Free Shipping",
  // "condition": "New",
  // "availability": "Out of Stock",
  // "link": "https://www.upcitemdb.com/norob/alink/?id=v2p2...",
  // "updated_t": 1479243029
  merchant: string;
  domain: string;
  title: string;
  currency: string;
  list_price: number;
  price: number;
  shipping: string;
  condition: string;
  availability: string;
  link: string;
  updated_t: number;
}

interface UpcItemDbItem {
  // "ean": "0885909950805",
  // "title": "Apple iPhone 6, Space Gray, 64 GB (T-Mobile)",
  // "upc": "885909950805",
  // "gtin": "string",
  // "asin": "B00NQGOZV0",
  // "description": "iPhone 6 isn't just bigger - it's better...",
  // "brand": "Apple",
  // "model": "MG5A2LL/A",
  // "dimension": "string",
  // "weight": "string",
  // "category": "Electronics > Communications > Telephony > Mobile Phones > Unlocked Mobile Phones",
  // "currency": "string",
  // "lowest_recorded_price": 3.79,
  // "highest_recorded_price": 8500,
  // "images": [
  //   "http://img1.r10.io/PIC/112231913/0/1/250/112231913.jpg"
  // ],
  ean: string;
  title: string;
  upc: string;
  brand: string;
  category: string;
  asin: string;
  description: string;
  images: string[];
  lowest_recorded_price: number;
  highest_recorded_price: number;
  model: string;
  dimension: string;
  weight: string;
  currency: string;
  offers: Array<UpcItemDbOffer>;
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
  params: Record<string, string>,
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
  upc: string,
): Promise<UpcLookupResult | null> {
  const data = await fetchUpcApi(BASE_URL, { upc });
  if (!data || data.total === 0 || !data.items?.length) return null;
  return mapItem(data.items[0]);
}

export async function searchByQuery(query: string): Promise<UpcLookupResult[]> {
  const data = await fetchUpcApi(SEARCH_URL, { s: query, type: "product" });
  if (!data || !data.items?.length) return [];
  return data.items.slice(0, 10).map(mapItem);
}
