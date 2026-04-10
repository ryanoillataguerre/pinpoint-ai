/**
 * Amazon flat file (inventory upload) generator.
 * Produces a tab-separated text file matching Amazon's Inventory Loader format.
 */

export interface AmazonExportItem {
  sku: string;
  asin: string | null;
  upc: string | null;
  canonicalName: string;
  brand: string | null;
  buyBoxPriceCents: number | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  quantity?: number;
  condition?: string;
}

const AMAZON_HEADERS = [
  "sku",
  "product-id",
  "product-id-type",
  "item-name",
  "brand",
  "price",
  "quantity",
  "condition-type",
  "item-description",
  "image-url",
];

function escapeField(value: string | null | undefined): string {
  if (value == null) return "";
  // Escape tabs and newlines in field values
  return value.replace(/\t/g, " ").replace(/\n/g, " ").replace(/\r/g, "");
}

/**
 * Generate an Amazon flat file (tab-separated) from export items.
 */
export function generateAmazonFlatFile(items: AmazonExportItem[]): string {
  const rows: string[] = [];

  // Header row
  rows.push(AMAZON_HEADERS.join("\t"));

  for (const item of items) {
    const productId = item.asin || item.upc || "";
    const productIdType = item.asin ? "ASIN" : item.upc ? "UPC" : "";
    const price = item.buyBoxPriceCents
      ? (item.buyBoxPriceCents / 100).toFixed(2)
      : "";

    const row = [
      escapeField(item.sku),
      escapeField(productId),
      productIdType,
      escapeField(item.canonicalName),
      escapeField(item.brand),
      price,
      String(item.quantity ?? 1),
      item.condition || "New",
      escapeField(item.description || item.canonicalName),
      escapeField(item.imageUrl),
    ];

    rows.push(row.join("\t"));
  }

  return rows.join("\n");
}
