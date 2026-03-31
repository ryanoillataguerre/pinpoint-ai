/**
 * Job service — RabbitMQ consumer that runs the matching pipeline.
 * Listens on extraction, normalization, matching, and pricing queues.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { setupQueues, registerConsumer, QUEUE_CONFIGS } from "../../lib/queue";
import type {
  ExtractionJobData,
  NormalizationJobData,
  MatchingJobData,
  PricingJobData,
} from "../../lib/queue";
import { createExtractionProcessor } from "./processors/extraction.processor";
import { createNormalizationProcessor } from "./processors/normalization.processor";
import { createMatchingProcessor } from "./processors/matching.processor";
import { createPricingProcessor } from "./processors/pricing.processor";

const prisma = new PrismaClient();

async function main() {
  console.log("Job service starting...");

  // Set up exchanges and queues
  await setupQueues();
  console.log("RabbitMQ queues initialized");

  // Create processors with shared Prisma client
  const extractionProcessor = createExtractionProcessor(prisma);
  const normalizationProcessor = createNormalizationProcessor(prisma);
  const matchingProcessor = createMatchingProcessor(prisma);
  const pricingProcessor = createPricingProcessor(prisma);

  // Register consumers
  await registerConsumer<ExtractionJobData>(
    QUEUE_CONFIGS.extraction,
    extractionProcessor
  );

  await registerConsumer<NormalizationJobData>(
    QUEUE_CONFIGS.normalization,
    normalizationProcessor
  );

  await registerConsumer<MatchingJobData>(
    QUEUE_CONFIGS.matching,
    matchingProcessor
  );

  await registerConsumer<PricingJobData>(
    QUEUE_CONFIGS.pricing,
    pricingProcessor
  );

  console.log("Job service ready — all consumers registered");
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Job service shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Job service interrupted...");
  await prisma.$disconnect();
  process.exit(0);
});

main().catch((err) => {
  console.error("Job service failed to start:", err);
  process.exit(1);
});
