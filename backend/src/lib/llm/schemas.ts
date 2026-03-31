// ─── Structured output schemas for pipeline LLM calls ────

export interface NormalizedItem {
  normalizedDescription: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  material: string | null;
  keywords: string[];
  searchQuery: string;
}

export const NORMALIZATION_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    normalizedDescription: {
      type: "string",
      description: "Clean, standardized product description",
    },
    brand: { type: ["string", "null"], description: "Brand name if detected" },
    category: {
      type: ["string", "null"],
      description: "Product category (e.g. Shoes, T-Shirt, Backpack)",
    },
    size: { type: ["string", "null"], description: "Size if detected" },
    color: { type: ["string", "null"], description: "Color if detected" },
    material: { type: ["string", "null"], description: "Material if detected" },
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "Search keywords for product matching",
    },
    searchQuery: {
      type: "string",
      description:
        "Optimized search query for Amazon/UPC lookup (concise, no filler words)",
    },
  },
  required: [
    "normalizedDescription",
    "brand",
    "category",
    "size",
    "color",
    "material",
    "keywords",
    "searchQuery",
  ],
});

export interface ExtractionResult {
  items: Array<{
    description: string;
    brand: string | null;
    sku: string | null;
    upc: string | null;
    size: string | null;
    price: string | null;
    quantity: string | null;
  }>;
}

export const EXTRACTION_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          brand: { type: ["string", "null"] },
          sku: { type: ["string", "null"] },
          upc: { type: ["string", "null"] },
          size: { type: ["string", "null"] },
          price: { type: ["string", "null"] },
          quantity: { type: ["string", "null"] },
        },
        required: ["description"],
      },
    },
  },
  required: ["items"],
});

export interface MatchRankingResult {
  rankings: Array<{
    candidateIndex: number;
    confidence: number;
    reasoning: string;
  }>;
  bestMatchIndex: number | null;
  overallConfidence: number;
}

export const MATCH_RANKING_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    rankings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          candidateIndex: { type: "number" },
          confidence: {
            type: "number",
            description: "0.0 to 1.0 confidence score",
          },
          reasoning: { type: "string" },
        },
        required: ["candidateIndex", "confidence", "reasoning"],
      },
    },
    bestMatchIndex: {
      type: ["number", "null"],
      description: "Index of best match, or null if no good match",
    },
    overallConfidence: {
      type: "number",
      description: "Overall confidence in the best match (0.0-1.0)",
    },
  },
  required: ["rankings", "bestMatchIndex", "overallConfidence"],
});
