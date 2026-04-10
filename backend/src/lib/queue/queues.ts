export const EXCHANGES = {
  PIPELINE: "ex.pipeline",
  PIPELINE_DLX: "ex.pipeline.dlx",
} as const;

export const QUEUES = {
  EXTRACTION: "q.extraction",
  NORMALIZATION: "q.normalization",
  MATCHING: "q.matching",
  PRICING: "q.pricing",
  EXTRACTION_DLQ: "q.extraction.dlq",
  NORMALIZATION_DLQ: "q.normalization.dlq",
  MATCHING_DLQ: "q.matching.dlq",
  PRICING_DLQ: "q.pricing.dlq",
} as const;

export const ROUTING_KEYS = {
  EXTRACTION: "pipeline.extraction",
  NORMALIZATION: "pipeline.normalization",
  MATCHING: "pipeline.matching",
  PRICING: "pipeline.pricing",
} as const;

export interface QueueConfig {
  queue: string;
  dlq: string;
  routingKey: string;
  prefetch: number;
  maxAttempts: number;
  maxPriority?: number;
}

export const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  extraction: {
    queue: QUEUES.EXTRACTION,
    dlq: QUEUES.EXTRACTION_DLQ,
    routingKey: ROUTING_KEYS.EXTRACTION,
    prefetch: 3,
    maxAttempts: 3,
  },
  normalization: {
    queue: QUEUES.NORMALIZATION,
    dlq: QUEUES.NORMALIZATION_DLQ,
    routingKey: ROUTING_KEYS.NORMALIZATION,
    prefetch: 10,
    maxAttempts: 3,
  },
  matching: {
    queue: QUEUES.MATCHING,
    dlq: QUEUES.MATCHING_DLQ,
    routingKey: ROUTING_KEYS.MATCHING,
    prefetch: 5,
    maxAttempts: 3,
    maxPriority: 10,
  },
  pricing: {
    queue: QUEUES.PRICING,
    dlq: QUEUES.PRICING_DLQ,
    routingKey: ROUTING_KEYS.PRICING,
    prefetch: 5,
    maxAttempts: 3,
    maxPriority: 10,
  },
};
