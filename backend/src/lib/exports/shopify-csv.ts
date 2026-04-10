/**
 * Shopify product CSV generator.
 * Produces a CSV matching Shopify's product import format.
 */

export interface ShopifyExportItem {
  canonicalName: string;
  brand: string | null;
  category: string | null;
  description: string | null;
  sku: string | null;
  upc: string | null;
  buyBoxPriceCents: number | null;
  imageUrl: string | null;
}

const SHOPIFY_HEADERS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Type",
  "Tags",
  "Published",
  "Variant SKU",
  "Variant Price",
  "Variant Barcode",
  "Image Src",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 200);
}

function escapeCsvField(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  // Wrap in quotes if the value contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a Shopify-compatible CSV from export items.
 */
export function generateShopifyCSV(items: ShopifyExportItem[]): string {
  const rows: string[] = [];

  // Header row
  rows.push(SHOPIFY_HEADERS.join(","));

  for (const item of items) {
    const handle = slugify(item.canonicalName);
    const price = item.buyBoxPriceCents
      ? (item.buyBoxPriceCents / 100).toFixed(2)
      : "";

    // Build simple HTML description
    const bodyHtml = item.description
      ? `<p>${item.description}</p>`
      : `<p>${item.canonicalName}</p>`;

    // Build tags from category
    const tags = item.category
      ? item.category
          .split(/[>,/]/)
          .map((t) => t.trim())
          .filter(Boolean)
          .join(", ")
      : "";

    const row = [
      escapeCsvField(handle),
      escapeCsvField(item.canonicalName),
      escapeCsvField(bodyHtml),
      escapeCsvField(item.brand),
      escapeCsvField(item.category),
      escapeCsvField(tags),
      "TRUE",
      escapeCsvField(item.sku),
      price,
      escapeCsvField(item.upc),
      escapeCsvField(item.imageUrl),
    ];

    rows.push(row.join(","));
  }

  return rows.join("\n");
}
