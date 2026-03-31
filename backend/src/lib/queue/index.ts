export { rabbitmq } from "./connection";
export { setupQueues } from "./setup";
export { QUEUES, QUEUE_CONFIGS, EXCHANGES, ROUTING_KEYS } from "./queues";
export type { QueueConfig } from "./queues";
export { registerConsumer } from "./consumer";
export type { JobHandler } from "./consumer";
export {
  enqueueExtraction,
  enqueueNormalization,
  enqueueMatching,
  enqueuePricing,
  enqueueMatchingBatch,
} from "./producer";
export type {
  ExtractionJobData,
  NormalizationJobData,
  MatchingJobData,
  PricingJobData,
  JobMessage,
} from "./producer";
