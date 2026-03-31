-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "auth_provider" TEXT NOT NULL DEFAULT 'email',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "plan_tier" TEXT NOT NULL DEFAULT 'starter',
    "monthly_match_limit" INTEGER NOT NULL DEFAULT 500,
    "matches_used_this_period" INTEGER NOT NULL DEFAULT 0,
    "billing_period_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations_users" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheets" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "storage_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "matched_items" INTEGER NOT NULL DEFAULT 0,
    "review_items" INTEGER NOT NULL DEFAULT 0,
    "unmatched_items" INTEGER NOT NULL DEFAULT 0,
    "extraction_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sheet_items" (
    "id" UUID NOT NULL,
    "sheet_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_description" TEXT,
    "raw_brand" TEXT,
    "raw_sku" TEXT,
    "raw_upc" TEXT,
    "raw_size" TEXT,
    "raw_price" TEXT,
    "raw_data" JSONB,
    "normalized_brand" TEXT,
    "normalized_description" TEXT,
    "normalized_size" TEXT,
    "normalized_category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "match_confidence" DOUBLE PRECISION,
    "match_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sheet_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_candidates" (
    "id" UUID NOT NULL,
    "sheet_item_id" UUID NOT NULL,
    "asin" TEXT,
    "upc" TEXT,
    "title" TEXT,
    "brand" TEXT,
    "image_url" TEXT,
    "source" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "match_reasoning" JSONB,
    "llm_choice" BOOLEAN NOT NULL DEFAULT false,
    "upc_exact_match" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matched_products" (
    "id" UUID NOT NULL,
    "sheet_item_id" UUID NOT NULL,
    "asin" TEXT,
    "upc" TEXT,
    "canonical_name" TEXT,
    "brand" TEXT,
    "category" TEXT,
    "image_url" TEXT,
    "match_method" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matched_by_user_id" UUID,
    "matched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matched_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_data" (
    "id" UUID NOT NULL,
    "matched_product_id" UUID NOT NULL,
    "asin" TEXT,
    "buy_box_price_cents" INTEGER,
    "avg_30_day_price_cents" INTEGER,
    "avg_90_day_price_cents" INTEGER,
    "lowest_price_cents" INTEGER,
    "sold_last_month" INTEGER,
    "total_offers" INTEGER,
    "competitive_sellers" INTEGER,
    "dominant_seller_id" TEXT,
    "profit_margin" DOUBLE PRECISION,
    "roi" DOUBLE PRECISION,
    "bsr_category" TEXT,
    "bsr_rank" INTEGER,
    "raw_keepa_data" JSONB,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_feedback" (
    "id" UUID NOT NULL,
    "sheet_item_id" UUID NOT NULL,
    "suggested_match_id" UUID,
    "accepted_match_id" UUID,
    "action" TEXT NOT NULL,
    "mismatch_reason" TEXT,
    "reviewer_id" UUID NOT NULL,
    "time_to_decision_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "stripe_subscription_id" TEXT,
    "plan_tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "match_limit" INTEGER NOT NULL,
    "price_per_match_cents" INTEGER NOT NULL DEFAULT 10,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_aliases" (
    "canonical_brand" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_aliases_pkey" PRIMARY KEY ("canonical_brand","alias")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_users_org_id_user_id_key" ON "organizations_users"("org_id", "user_id");

-- CreateIndex
CREATE INDEX "sheets_org_id_status_idx" ON "sheets"("org_id", "status");

-- CreateIndex
CREATE INDEX "sheet_items_sheet_id_status_idx" ON "sheet_items"("sheet_id", "status");

-- CreateIndex
CREATE INDEX "match_candidates_sheet_item_id_rank_idx" ON "match_candidates"("sheet_item_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "matched_products_sheet_item_id_key" ON "matched_products"("sheet_item_id");

-- CreateIndex
CREATE INDEX "matched_products_asin_idx" ON "matched_products"("asin");

-- CreateIndex
CREATE INDEX "matched_products_upc_idx" ON "matched_products"("upc");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_data_matched_product_id_key" ON "pricing_data"("matched_product_id");

-- CreateIndex
CREATE INDEX "pricing_data_asin_idx" ON "pricing_data"("asin");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "brand_aliases_alias_idx" ON "brand_aliases"("alias");

-- AddForeignKey
ALTER TABLE "organizations_users" ADD CONSTRAINT "organizations_users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations_users" ADD CONSTRAINT "organizations_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheets" ADD CONSTRAINT "sheets_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sheet_items" ADD CONSTRAINT "sheet_items_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_sheet_item_id_fkey" FOREIGN KEY ("sheet_item_id") REFERENCES "sheet_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matched_products" ADD CONSTRAINT "matched_products_sheet_item_id_fkey" FOREIGN KEY ("sheet_item_id") REFERENCES "sheet_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matched_products" ADD CONSTRAINT "matched_products_matched_by_user_id_fkey" FOREIGN KEY ("matched_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_data" ADD CONSTRAINT "pricing_data_matched_product_id_fkey" FOREIGN KEY ("matched_product_id") REFERENCES "matched_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_sheet_item_id_fkey" FOREIGN KEY ("sheet_item_id") REFERENCES "sheet_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
