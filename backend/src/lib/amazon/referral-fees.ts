/**
 * Amazon referral fee rates by category.
 * Source: Amazon's published referral fee schedule.
 *
 * Rates represent the percentage Amazon takes as a referral fee.
 * A rough fulfillment estimate (0.15) is added separately when
 * calculating total fees.
 */

const CATEGORY_FEES = new Map<string, number>([
  // Electronics & Computers
  ["electronics", 0.08],
  ["computers", 0.08],
  ["computer", 0.08],
  ["pc", 0.08],
  ["laptop", 0.08],
  ["tablet", 0.08],
  ["camera", 0.08],
  ["cell phones", 0.08],
  ["cell phone", 0.08],
  ["phone", 0.08],

  // Media & Entertainment
  ["video games", 0.15],
  ["video game", 0.15],
  ["books", 0.15],
  ["book", 0.15],
  ["music", 0.15],
  ["musical instruments", 0.15],
  ["movies", 0.15],
  ["dvd", 0.15],
  ["software", 0.15],

  // Clothing & Accessories
  ["clothing", 0.17],
  ["apparel", 0.17],
  ["shoes", 0.15],
  ["handbags", 0.15],
  ["luggage", 0.15],
  ["jewelry", 0.20],
  ["watches", 0.16],
  ["sunglasses", 0.16],

  // Home & Garden
  ["home", 0.15],
  ["home & kitchen", 0.15],
  ["kitchen", 0.15],
  ["garden", 0.15],
  ["furniture", 0.15],
  ["home improvement", 0.15],
  ["patio", 0.15],

  // Grocery & Consumables
  ["grocery", 0.08],
  ["gourmet food", 0.15],
  ["health", 0.08],
  ["beauty", 0.08],
  ["personal care", 0.08],

  // Toys & Baby
  ["toys", 0.15],
  ["toys & games", 0.15],
  ["baby", 0.08],
  ["baby products", 0.08],

  // Sports & Outdoors
  ["sports", 0.15],
  ["sports & outdoors", 0.15],
  ["outdoors", 0.15],
  ["exercise", 0.15],

  // Automotive & Industrial
  ["automotive", 0.12],
  ["auto", 0.12],
  ["tires", 0.10],
  ["industrial", 0.12],
  ["tools", 0.15],
  ["tools & home improvement", 0.15],

  // Pets
  ["pet supplies", 0.15],
  ["pet", 0.15],
  ["pets", 0.15],

  // Office & School
  ["office", 0.15],
  ["office products", 0.15],
  ["arts", 0.15],
  ["crafts", 0.15],

  // Collectibles & Specialty
  ["collectibles", 0.15],
  ["collectible coins", 0.15],
  ["gift cards", 0.20],
  ["amazon device accessories", 0.45],
]);

const DEFAULT_REFERRAL_RATE = 0.15;

/**
 * Estimated fulfillment cost as a fraction of selling price.
 * This is a rough approximation of FBA fees when the exact
 * weight/dimensions are not available.
 */
export const FULFILLMENT_ESTIMATE = 0.15;

/**
 * Get the Amazon referral fee rate for a given category.
 * Performs fuzzy matching by checking if any known category keyword
 * appears in the input string.
 *
 * @param category - The product category string (e.g. from Keepa's BSR category)
 * @returns The referral fee rate (e.g. 0.15 = 15%)
 */
export function getReferralFeeRate(category: string | null | undefined): number {
  if (!category) return DEFAULT_REFERRAL_RATE;

  const lower = category.toLowerCase().trim();

  // Try exact match first
  const exact = CATEGORY_FEES.get(lower);
  if (exact !== undefined) return exact;

  // Fuzzy: check if any known category key is contained in the input
  for (const [key, rate] of CATEGORY_FEES) {
    if (lower.includes(key) || key.includes(lower)) {
      return rate;
    }
  }

  return DEFAULT_REFERRAL_RATE;
}

/**
 * Calculate total estimated Amazon fees (referral + fulfillment) as a fraction.
 */
export function getTotalFeeRate(category: string | null | undefined): number {
  return getReferralFeeRate(category) + FULFILLMENT_ESTIMATE;
}
