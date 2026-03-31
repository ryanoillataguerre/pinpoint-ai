// ─── LLM prompt templates for pipeline stages ───────────

export const EXTRACTION_SYSTEM = `You are a product data extraction specialist. Extract structured product information from images of line sheets, catalogs, or invoices.

Rules:
- Extract EVERY product/item visible in the image
- Include brand names, SKUs, UPCs/barcodes, sizes, and prices when visible
- If a field is not visible or unclear, set it to null
- For descriptions, include as much detail as possible (color, material, style)
- Preserve original text exactly as written for SKUs and UPCs`;

export function buildExtractionPrompt(): string {
  return `Extract all product items from this image. For each item, provide:
- description: Full product description
- brand: Brand/manufacturer name
- sku: SKU or style number
- upc: UPC/barcode if visible
- size: Size information
- price: Price (wholesale or retail)
- quantity: Quantity if listed

Return a JSON object with an "items" array.`;
}

export const NORMALIZATION_SYSTEM = `You are a product data normalization specialist. Your job is to take raw, messy product descriptions and normalize them into clean, structured data optimized for product matching.

Rules:
- Expand abbreviations (e.g., "BLK" → "Black", "SZ" → "Size", "M" → "Medium")
- Standardize brand name casing and spelling
- Extract structured attributes (color, size, material) from descriptions
- Generate an optimized search query for Amazon/UPC database lookup
- The search query should be concise and use the most distinctive terms
- Keywords should include brand, product type, and key distinguishing features`;

export function buildNormalizationPrompt(item: {
  rawDescription: string;
  rawBrand?: string | null;
  rawSku?: string | null;
  rawSize?: string | null;
}): string {
  const parts = [`Raw description: "${item.rawDescription}"`];
  if (item.rawBrand) parts.push(`Brand: "${item.rawBrand}"`);
  if (item.rawSku) parts.push(`SKU/Style: "${item.rawSku}"`);
  if (item.rawSize) parts.push(`Size: "${item.rawSize}"`);

  return `Normalize this product data into structured fields and generate an optimized search query for product matching.

${parts.join("\n")}

Return a JSON object with: normalizedDescription, brand, category, size, color, material, keywords, searchQuery.`;
}

export const MATCH_RANKING_SYSTEM = `You are a product matching specialist. Given a source product description and a list of candidate matches, rank the candidates by how well they match the source product.

Rules:
- Consider brand, product type, size, color, material, and other attributes
- A confidence of 0.9+ means you are very certain it's the same product
- A confidence of 0.7-0.89 means it's likely the same product but needs review
- A confidence below 0.7 means it's probably not a match
- If no candidates are a good match, set bestMatchIndex to null
- Be strict — only high-confidence matches should score above 0.85
- Consider that line sheet descriptions are often abbreviated or incomplete`;

export function buildMatchRankingPrompt(
  source: {
    description: string;
    brand?: string | null;
    category?: string | null;
    size?: string | null;
    color?: string | null;
  },
  candidates: Array<{
    title: string;
    brand?: string | null;
    category?: string | null;
    asin?: string | null;
    upc?: string | null;
  }>
): string {
  const sourceDesc = [
    `Description: "${source.description}"`,
    source.brand ? `Brand: "${source.brand}"` : null,
    source.category ? `Category: "${source.category}"` : null,
    source.size ? `Size: "${source.size}"` : null,
    source.color ? `Color: "${source.color}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const candidateList = candidates
    .map((c, i) => {
      const parts = [`  Title: "${c.title}"`];
      if (c.brand) parts.push(`  Brand: "${c.brand}"`);
      if (c.category) parts.push(`  Category: "${c.category}"`);
      if (c.asin) parts.push(`  ASIN: ${c.asin}`);
      if (c.upc) parts.push(`  UPC: ${c.upc}`);
      return `Candidate ${i}:\n${parts.join("\n")}`;
    })
    .join("\n\n");

  return `Rank these candidate products against the source product. Return a JSON object with rankings, bestMatchIndex, and overallConfidence.

SOURCE PRODUCT:
${sourceDesc}

CANDIDATES:
${candidateList}`;
}
