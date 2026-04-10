/**
 * Pricing processor — fetches Amazon pricing data for matched products.
 * Uses Keepa API for detailed pricing, sales rank, and competition data.
 */

import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { getProductPricing } from "../../../lib/external/keepa";
import {
  getEbayPricing,
  isConfigured as ebayIsConfigured,
} from "../../../lib/external/ebay";
import { PricingJobData } from "../../../lib/queue";
import { getReferralFeeRate, FULFILLMENT_ESTIMATE } from "../../../lib/amazon/referral-fees";
import { cacheOrgTier } from "../../../lib/external/keepa-rate-limiter";

export function createPricingProcessor(prisma: PrismaClient) {
  return async function processPricing(
    data: PricingJobData
  ): Promise<void> {
    const { matchedProductId, asin, sheetId } = data;

    const matchedProduct = await prisma.matchedProduct.findUnique({
      where: { id: matchedProductId },
    });

    if (!matchedProduct) {
      console.error(`Pricing: matched product ${matchedProductId} not found`);
      return;
    }

    // Resolve orgId for rate limiting
    let orgId = data.orgId;
    if (!orgId) {
      const sheet = await prisma.sheet.findUnique({
        where: { id: sheetId },
        select: { orgId: true },
      });
      orgId = sheet?.orgId;
    }

    try {
      const pricing = await getProductPricing(asin, 1, orgId);

      if (!pricing) {
        console.warn(`Pricing: no data returned for ASIN ${asin}`);
        return;
      }

      // Calculate profit margin if we have wholesale price and buy box
      let profitMargin: number | null = null;
      let roi: number | null = null;

      const item = await prisma.sheetItem.findUnique({
        where: { id: matchedProduct.sheetItemId },
      });

      // Determine category for fee calculation
      const category = pricing.bsrCategory || matchedProduct.category;
      const referralRate = getReferralFeeRate(category);
      const totalFeeRate = referralRate + FULFILLMENT_ESTIMATE;

      if (item?.rawPrice && pricing.buyBoxPriceCents) {
        const wholesaleCents = parsePriceToCents(item.rawPrice);
        if (wholesaleCents && wholesaleCents > 0) {
          const estimatedFees = pricing.buyBoxPriceCents * totalFeeRate;
          const profit =
            pricing.buyBoxPriceCents - wholesaleCents - estimatedFees;
          profitMargin = profit / pricing.buyBoxPriceCents;
          roi = profit / wholesaleCents;
        }
      }

      // Fetch eBay pricing for cross-marketplace comparison
      let ebayAvgPriceCents: number | null = null;
      let ebayListingCount: number | null = null;
      let ebayLowestPriceCents: number | null = null;

      if (ebayIsConfigured() && matchedProduct.canonicalName) {
        try {
          const ebayPricing = await getEbayPricing(
            matchedProduct.canonicalName
          );
          if (ebayPricing) {
            ebayAvgPriceCents = ebayPricing.avgPriceCents;
            ebayLowestPriceCents = ebayPricing.lowestPriceCents;
            ebayListingCount = ebayPricing.listingCount;
          }
        } catch (err) {
          console.warn("eBay pricing fetch failed:", err);
        }
      }

      await prisma.pricingData.create({
        data: {
          id: uuidv4(),
          matchedProductId,
          asin,
          buyBoxPriceCents: pricing.buyBoxPriceCents,
          avg30DayPriceCents: pricing.avg30DayPriceCents,
          avg90DayPriceCents: pricing.avg90DayPriceCents,
          lowestPriceCents: pricing.lowestPriceCents,
          soldLastMonth: pricing.soldLastMonth,
          totalOffers: pricing.totalOffers,
          bsrCategory: pricing.bsrCategory,
          bsrRank: pricing.bsrRank,
          profitMargin,
          roi,
          feeRate: referralRate,
          ebayAvgPriceCents,
          ebayListingCount,
          ebayLowestPriceCents,
          rawKeepaData: pricing.rawKeepaData as object,
        },
      });

      console.log(
        `Pricing complete for ASIN ${asin} (product ${matchedProductId})`
      );
    } catch (err) {
      console.error(`Pricing failed for ASIN ${asin}:`, err);
      throw err;
    }
  };
}

function parsePriceToCents(priceStr: string): number | null {
  const cleaned = priceStr.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}
