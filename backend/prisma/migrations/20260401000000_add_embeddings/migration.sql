-- Add embedding column to matched_products for similarity search
ALTER TABLE "matched_products" ADD COLUMN "embedding" vector(1536);

-- Create HNSW index for fast similarity search
CREATE INDEX "matched_products_embedding_idx" ON "matched_products" USING hnsw ("embedding" vector_cosine_ops);

-- Add embedding column to sheet_items for finding similar past items
ALTER TABLE "sheet_items" ADD COLUMN "normalized_embedding" vector(1536);
CREATE INDEX "sheet_items_embedding_idx" ON "sheet_items" USING hnsw ("normalized_embedding" vector_cosine_ops);
