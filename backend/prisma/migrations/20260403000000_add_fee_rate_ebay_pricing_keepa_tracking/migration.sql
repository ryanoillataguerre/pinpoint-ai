-- Feature #15: Category-based Amazon referral fees
ALTER TABLE "pricing_data" ADD COLUMN "fee_rate" DOUBLE PRECISION;

-- Feature #9: eBay marketplace pricing data
ALTER TABLE "pricing_data" ADD COLUMN "ebay_avg_price_cents" INTEGER;
ALTER TABLE "pricing_data" ADD COLUMN "ebay_listing_count" INTEGER;
ALTER TABLE "pricing_data" ADD COLUMN "ebay_lowest_price_cents" INTEGER;

-- Feature #3: Keepa cost controls — per-org usage tracking
ALTER TABLE "organizations" ADD COLUMN "keepa_tokens_used_today" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "organizations" ADD COLUMN "keepa_tokens_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
